import React, { PureComponent } from 'react';
import { Upload, Icon, Button, Progress, Modal, Spin, message } from 'antd';
// import request from 'superagent';
import SparkMd5 from 'spark-md5';
import './index.css';

const { confirm } = Modal;
const { Dragger } = Upload;
const MAX = 4;

class FileUpload extends PureComponent {
  constructor(props) {
    super(props);
    this.uploadAjax = []; // 上传ajax对象，用于取消请求
    this.currentChunks = MAX; // // 当前上传的队列个数，当前还剩下多少个分片没上传
    this.uploadList = []; // 分片请求信息
    this.totalChunks = 0; // 已上传分片
    this.chunkSize = 1024 * 1024 * 2;
    this.isStop = true;
    this.state = {
      preUploading: false, // 预处理
      chunksSize: 0, // 上传文件分块的总个数
      uploadPrecent: 0, // 上传率
      preUploadPercent: 0, // 预处理率
      uploadRequest: false, // 上传请求，即进行第一个过程中
      uploaded: false, // 表示文件是否上传成功
      uploading: false, // 上传中状态
      uploadParams: {}, // 上传参数
      arrayBufferData: [], // 分片信息
    };
  }

  showConfirm = () => {
    confirm({
      title: '是否提交上传?',
      content: '点击确认进行提交',
      onOk: () => {
        // this.preUpload();
        this.uploadList = this.state.arrayBufferData;
        this.totalChunks = this.uploadList.length;
        console.log(this.uploadList);
        this.setState({
          uploading: true
        });
        this.handlePartUpload(this.uploadList);
      }
    });
  }

  preUpload = () => {
    const { uploadParams, chunksSize } = this.state;
    /**
     * 此时应该使用 uploadParams 参数对后端进行请求，得到整个文件哪些分片已经上传过，这个接口走完以后整个文件
      的上传的md5信息就应该使用后端返回的，而不应该用本地的 uploadParams 
     */
    fetch('url', uploadParams)
    .then(res => res.json)
    .then(data => {
      if (data.code === 200) {
        /** 这里模拟后端返回数据格式为
         * {
              Chunks:[
                {
                  chunk: 1, 
                  chunkMd5:"8770f43dc59effdc8b995e4aacc8a26c", 
                  fileMd5:"f5aeec69076483585f4f672223265c0c",
                  end: 5242880,
                  start:0,
                  status:"pending"
                },
                …
              ],
              Code:200,
              FileMd5:"f5aeec69076483585f4f672223265c0c"
              MaxThreads:1,
              Message:"OK",
              Total:119,
              Uploaded:0
            }
          */
        let uploadList = data.result.chunks.filter(item => item.status === 'pending');
        // 从返回结果中获取当前还有多少个分片未上传
        let currentChunks = data.result.Total - data.result.Uploaded;

        // 获取进度条
        let uploadPercent = Number(((chunksSize - currentChunks) / chunksSize * 100).toFixed(2));
        
        // 上传之前，先判断文件是否已经上传成功
        if (uploadPercent === 100) {
          message.success('上传成功');
          this.setState({
            uploaded: true, // 进度条消失
            uploading: false,
          });
        } else {
          this.setState({
            uploaded: false,
            uploading: true,
          });
        }

        this.setState({
          uploadRequest: false, // 上传请求成功
          uploadPercent
        });
        // this.currentChunks = currentChunks;
        this.uploadList = uploadList;
        // 进行分片上传
        this.handlePartUpload(uploadList);
      }
    })
  }
  
  // 分片上传
  handlePartUpload = (uploadList) => {
    // 遍历uploadList 
    // 这里需要做一个并发限制，防止tcp连接数过多
    this.isStop = false;
    for (let i = 0; i < MAX; i++) {
      this.hanlder(uploadList[i]);
    }
  }

  hanlder = (file) => {
    const { uploadParams } = this.state;
    const { uploadList } = this;
    let { chunk } = file;
    let formData = new FormData(),
        // 新建一个blob对象，将对应分片的arrayBuffer加入Blob中
        blob = new Blob([uploadList[chunk].currentChunk], { type: 'application/octet-stream' });
    // 将生成的blob塞入到formData中传入服务端
    formData.append('file', blob);
    formData.append('type', 'application/octet-stream');
    formData.append('size', uploadParams.file.fileSize);
    formData.append('lastModifiedDate', uploadParams.file.lastModifiedDate);
    formData.append('md5', uploadParams.file.fileMd5);
    formData.append('name', uploadParams.file.fileName);
    formData.append('id', uploadParams.file.id);
    formData.append('chunk', chunk);
    formData.append('chunks', uploadList.length);
    return this.xhrSend(formData)
    .then(() => {
      if (this.isStop) return;
      this.totalChunks--;
      this.uploadList[chunk].state = true;
      // 这里需要控制最后一个分片必须等待所有分片传输完成以后再发送
      const e = this.uploadList.filter(item => item.chunk !== this.uploadList.length - 1).every(item => item.state);
      if ((this.totalChunks === 1) && e) {
        this.hanlder(this.uploadList[this.currentChunks])
        .then(() => {
          console.log('上传完成，发送合并请求');
          this.setState({
            uploadPercent: 100,
            uploading: false,
            uploaded: true
          });
        });
      } else if(this.totalChunks > 1) {
        this.setState({
          uploadPercent: Number((((uploadList.length - this.totalChunks) / uploadList.length) * 100).toFixed(2))
        });
        if (this.currentChunks === this.uploadList.length - 1) return;;
        this.hanlder(this.uploadList[this.currentChunks]);
        this.currentChunks++;
      }
    })
    .catch(err => {
      // 请求错误，终止请求
      this.stopUpload();
      console.log(err);
    })
  }

  xhrSend = (fd) => {
    return new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();   //创建对象
      this.uploadAjax.push(xhr);
      xhr.open('POST', 'http://47.96.80.210:8080/upload', true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (JSON.parse(xhr.responseText || '{}').status !== 500) {
            resolve(xhr.responseText);
          } else {
            reject(xhr.responseText);
          }
        }
      }
      xhr.onerror = function (err) {
        reject(err);
      }
      //注意 send 一定要写在最下面，否则 onprogress 只会执行最后一次 也就是100%的时候
      xhr.send(fd);//发送时  Content-Type默认就是: multipart/form-data; 
    })
  }

  beforeUpload = (file) => {
    console.log(file);
    
    // 清除各种上传的状态
    this.setState({
      uploaded: false, // 上传成功
      uploading: false, // 上传中
      uploadRequest: false, // 上传预处理
    });
    // 兼容性处理
    let blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice,
        chunkSize = this.chunkSize,
        chunks = Math.ceil(file.size / chunkSize),
        currentChunk = 0, // 当前上传的chunk
        spark = new SparkMd5.ArrayBuffer(),
        // 对arrayBuffer数据进行md5加密，产生一个md5字符串
        chunkFileReader = new FileReader(), // 用于计算出每个chunkMd5
        totalFileReader = new FileReader(); // 用于计算出总文件的fileMd5
    let params = { chunks: [], file: {} }, // 用于上传所有分片的md5信息
        arrayBufferData = []; // 用于储存每个chunk的arrayBuffer对象，用于分片上传使用
    params.file.fileName = file.name;
    params.file.fileSize = file.size;
    params.file.lastModifiedDate = file.lastModifiedDate;
    params.file.id = file.uid;
    totalFileReader.readAsArrayBuffer(file);
    totalFileReader.onload = (e) => {
      // 对整个totalFile生成md5
      spark.append(e.target.result);
      params.file.fileMd5 = spark.end();// 计算整个文件的fileMd5
    }
    
    chunkFileReader.onload = (e) => {
      // 对每一片分片进行md5加密
      spark.append(e.target.result);
      // 每一个分片需要包含的信息
      let obj = {
        chunk: currentChunk,
        start: currentChunk * chunkSize, // 计算分片的起始位置
        end: ((currentChunk * chunkSize + chunkSize) >= file.size) ? file.size : currentChunk * chunkSize + chunkSize, // 计算分片结束的位置
        chunkMd5: spark.end(),
        chunks
      }
      // 每一次分片onload，currentChunk都需要增加，以便来计算分片的次数
      currentChunk ++;
      params.chunks.push(obj);

      // 将每一片分片的arrayBuffer存储起来，用来partUpload
      let tmp = {
        chunk: obj.chunk,
        currentChunk: e.target.result
      };

      arrayBufferData.push(tmp);

      if (currentChunk < chunks) {
        // 当前切片总数没有达到总数时
        loadNext();

        // 计算预处理进度条
        this.setState({
          preUploading: true,
          preUploadPercent: Number((currentChunk / chunks * 100).toFixed(2))
        });
      }else {
        // 记录所有chunks的长度
        params.file.fileChunks = params.chunks.length;
        console.log(params, arrayBufferData);
        
        // 表示预处理结束，将上传的参数，arrayBuffer的数据存储起来
        this.setState({
          preUploading: false,
          uploadParams: params,
          arrayBufferData,
          chunkSize: chunks,
          preUploadPercent: 100
        });
      }
    }

    chunkFileReader.onerror = () => {
      console.warn('oops, something went wrong.');
    }
    function loadNext() {
      const start = currentChunk * chunkSize,
            end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;
      chunkFileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
    }

    loadNext();
    
    // 只允许一份文件上传
    this.setState({
      fileList: [file],
      file
    });

    return false;
  }
  
  // 停止上传
  stopUpload = () => {
    this.uploadAjax.forEach(ajax => ajax.abort());
    this.isStop = true;
  }

  render() {
    const { preUploading, uploadPercent, preUploadPercent, uploadRequest, uploaded, uploading } = this.state;
    const uploadProp = {
      onRemove: (file) => {
        this.setState(({fileList}) => {
          const _fileList = fileList.filter(item => item !== file);
          return {
            fileList: _fileList
          }
        });
      },
      beforeUpload: this.beforeUpload,
      fileList: this.state.fileList,
    }
    return (
      <div className="content-inner">
        <Spin 
          tip={
            <div>
              <h3 style={{margin:'10px auto',color:'#1890ff'}}>文件预处理中...</h3>
              <Progress width={80} percent={preUploadPercent} type="circle" status="active" />
            </div>
          } 
          spinning={preUploading} 
          style={{ height: 350 }}
        >
          <div style={{ marginTop: 16, height: 250 }}>
            <Dragger {...uploadProp}>
              <p className="ant-upload-drag-icon">
                <Icon type="inbox" />
              </p>
              <p className="ant-upload-text">点击或者拖拽文件进行上传</p>
              <p className="ant-upload-hint">Support for a single or bulk upload. Strictly prohibit from uploading company data or other band files</p>
            </Dragger>
            { uploadPercent >= 0 && !!uploading && (
              <div style={{marginTop:20, width:'95%'}}>
                <Progress percent={uploadPercent} status="active" />
                <h4>文件上传中，请勿关闭窗口</h4>
              </div>
            )}
            { !!uploadRequest && <h4 style={{color:'#1890ff'}}>上传请求中...</h4> }
            { !!uploaded && <h4 style={{color:'#52c41a'}}>文件上传成功</h4> }
            <Button type="primary" onClick={this.showConfirm} disabled={!!(this.state.preUploadPercent < 100)}>
              <Icon type="upload" />提交上传
            </Button>
            <Button onClick={this.stopUpload} type="danger">终止请求</Button>
          </div>
        </Spin>
      </div>
    )
  }
}

export default FileUpload;