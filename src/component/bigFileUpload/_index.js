import { useState, useCallback, useRef } from 'react';
import SparkMd5 from 'spark-md5';
import { message } from 'antd';

const MAXRequest = 4;

//获得本地缓存的数据
function getUploadedFromStorage(saveChunkKey) {
  return JSON.parse( sessionStorage.getItem(saveChunkKey) || "{}");
}

//写入缓存
function setUploadedToStorage(saveChunkKey, index) {
  let obj =  getUploadedFromStorage(saveChunkKey);
  obj[index] = true;      
  sessionStorage.setItem(saveChunkKey, JSON.stringify(obj));
}

function useFileUpload(
  url, 
  uploadFormatParams, 
  chunkSize = 1024 * 1024 * 2,
  uploadBeforeMethod
) {
  const [state, set] = useState({
    uploadPercent: 0, // 上传百分比
    preUploadPercent: 0, // 文件分片预处理百分比
    preUploading: false, // 预处理loading
    uploadRequest: false, // 是否正在上传
    uploaded: false, // 是否上传完成 
    fileList: []
  });

  const urlRef = useRef(url); // 上传接口地址
  urlRef.current = url; 

  const uploadFormatParamsRef = useRef(uploadFormatParams); // 参数转换函数
  uploadFormatParamsRef.current = uploadFormatParams;

  const uploadBeforeMethodRef = useRef(uploadBeforeMethod); // 请求前确认
  uploadBeforeMethodRef.current = uploadBeforeMethod;
  
  const uploadAjax = useRef([]); // 所有请求的ajax对象
  const isStop = useRef(false); // 是否停止上传
  const uploadList = useRef([]); // 所有需要请求的分片信息
  const arrayBufferData = useRef([]); // 总的分片信息

  const uploadedTotal = useRef(0); // 已上传分片数量
  const currentChunks = useRef(0); // 当前上传的队列个数，当前还剩下多少个分片没上传
  const chunksSizeRef = useRef(chunkSize); // 分片大小
  chunksSizeRef.current = chunkSize;

  const uploadParams = useRef({});
  // 删除
  const onRemove = (file) => {
    set(s => ({
      ...s,
      fileList: s.fileList.filter(item => item !== file)
    }));
  }

  // 上传前
  const beforeUpload = (file) => {
    // 清除各种上传状态
    set(s => ({
      ...s, 
      uploadRequest: false, 
      uploaded: false,
    }));

    let blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice,
        chunks = Math.ceil(file.size / chunksSizeRef.current),
        currentChunk = 0, // 当前上传的chunk
        spark = new SparkMd5.ArrayBuffer(),
        // 对arrayBuffer数据进行md5加密，产生一个md5的字符串
        chunkFileReader = new FileReader(), // 用于计算出每个chunkMd5
        totalFileReader = new FileReader(); // 用于计算出总文件的fileMd5

    let params = { chunks: [], file: {} }, // 用于上传所有分片的md5信息
        _arrayBufferData = []; // 用于储存每个chunk的arrayBuffer对象，用于分片上传使用
    const { name, size, type, uid, lastModifiedDate, lastModified } = file;
    params.file = { 
      name, 
      size, 
      type, 
      uid, 
      lastModifiedDate, 
      lastModified,
      fileChunks: chunks
    };

    // 总文件读取处理
    totalFileReader.readAsArrayBuffer(file);
    totalFileReader.onload = (e) => {
      // 对整个totalFile生成md5
      spark.append(e.target.result);
      params.file.fileMd5 = spark.end(); // 计算整个文件的fileMd5
    }
    // 分片文件读取处理
    chunkFileReader.onload = (e) => {
      // 对每一片分片进行md5加密
      spark.append(e.target.result);
      // 每一个分片需要包含的信息
      const startSize = currentChunk * chunksSizeRef.current;
      let obj = {
        chunk: currentChunk,
        start: startSize, // 计算分片的起始位置
        end: Math.min(startSize + chunksSizeRef.current, file.size),
        chunkMd5: spark.end(),
        chunks
      };
      // 将每一片分片的arrayBuffer存储起来
      let tmp = {
        chunk: currentChunk,
        chunkBuffer: e.target.result
      };
      // 每一次分片onload，currentChunk都需要增加，以便来计算分片的次数
      currentChunk ++;
      params.chunks.push(obj);
      _arrayBufferData.push(tmp);

      if (currentChunk < chunks) {
        // 当前切片总数没有达到总数时
        loadNext();
        // 计算预处理进度条
        set(s => ({
          preUploading: true,
          preUploadPercent: Number((currentChunk / chunks * 100).toFixed(2))
        }));
      } else {
        // 表示与预处理结束，将上传的参数，arrayBuffer的数据存储起来
        set(s => ({
          preUploading: false,
          preUploadPercent: 100,
          fileList: [file]
        }));
        uploadParams.current = params;
        arrayBufferData.current = _arrayBufferData;
      }
    }

    const loadNext = () => {
      const start = currentChunk * chunksSizeRef.current,
            end = Math.min(start + chunksSizeRef.current, file.size);
      chunkFileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
    }

    loadNext();
    return false;
  }

  // 上传请求
  const xhrSend = useCallback((fd) => {
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();   //创建对象
      uploadAjax.current.push(xhr);
      xhr.open('POST', urlRef.current, true);
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
      xhr.send(fd);//发送时  Content-Type默认就是: multipart/form-data; 
    });
  }, []);

  // 暂停上传
  const stopUpload = useCallback(() => {
    uploadAjax.current.forEach(ajax => ajax.abort());
    isStop.current = true;
  }, []);

  // 上传操作
  const hanlder = useCallback((fileInfo) => {
    if (isStop.current) return;
    let { chunk } = fileInfo;
    let blob = new Blob(
      [arrayBufferData.current[chunk].chunkBuffer], 
      {type: 'application/octet-stream'}
    );
    const formData = uploadFormatParamsRef.current({
      fileInfo,
      file: uploadParams.current.file,
      blob
    });
    return xhrSend(formData)
    .then(() => {
      setUploadedToStorage(uploadParams.current.file.fileMd5, chunk);
      uploadedTotal.current--;
      /**
       * 由于这里后端是自动判断接收到最后一个文件以后就直接
       * 合并分片文件，所以这里需要判断在最后一个文件上传之前
       * ，之前所有的请求是否完成。
       * 其实如果要做断点续传的话，这个是不需要的，只需要最后由
       * 客户端判断是否所有分片文件上传完成以后在发送一个合并文件请求，
       * 后端接收到后再合并是最好的，防止异步请求的不确定性
       */
      // uploadList.current = uploadList.current.map(item => {
      //   if (item.chunk === chunk) {
      //     item.status = 'done';
      //   }
      //   return item;
      // });
      // const isFulfil = uploadList.current
      //   .filter((item, i) => i !== uploadList.current.length - 1)
      //   .every(item => item.status === 'done');
      if (uploadedTotal.current === 0) {
        console.log('上传完成，发送合并请求');
        set(s => ({
          ...s,
          uploadPercent: 100,
          uploaded: true,
        }));
        // hanlder(uploadList.current[currentChunks.current])
        // .then(() => {
        //   console.log('上传完成，发送合并请求');
        //   set(s => ({
        //     ...s,
        //     uploadPercent: 100,
        //     uploaded: true,
        //   }));
        // });
      } else {
        set(s => ({
          ...s, 
          uploadPercent: Number((((arrayBufferData.current.length - uploadedTotal.current) / arrayBufferData.current.length) * 100).toFixed(2))
        }));
        if (currentChunks.current === uploadList.current.length) return;
        hanlder(uploadList.current[currentChunks.current]);
        currentChunks.current++;
      }
    })
    .catch(err => {
      // 请求错误，终止请求
      console.log(err);
      stopUpload();
    })
  }, [xhrSend, stopUpload]);
  
  const filterChunk = useCallback((data) => {
    let _uploadList = data.chunks.filter(item => item.status === 'pending');
    // 从返回结果中获取当前还有多少个分片未上传
    let _currentChunks = data.Total - data.Uploaded;
    // 获取进度条
    let _uploadPercent = Number(((data.Total - _currentChunks) / data.Total * 100).toFixed(2));
    // 上传之前，先判断文件是否已经上传成功
    if (_uploadPercent === 100) {
      message.success('上传成功');
      set(s => ({ ...s, uploaded: true }));
    } else {
      set(s => ({ ...s, uploaded: false }));
    }
    set(s => ({
      ...s,
      uploadRequest: false,
      uploadPercent: _uploadPercent
    }));
    uploadList.current = _uploadList;
    uploadedTotal.current = _currentChunks;
    currentChunks.current = Math.min(MAXRequest, _currentChunks);
    for (let i = 0; i < currentChunks.current; i++) {
      hanlder(uploadList.current[i]);
    };
  }, [hanlder]);

  // 上传前过滤掉已上传分片
  const onUpload = useCallback(() => {
    isStop.current = false;
    if (uploadBeforeMethodRef.current) {
      uploadBeforeMethodRef.current(uploadParams.current)
      .then(data => {
        filterChunk(data);
      });
    } else {
      let uploadedChunks = getUploadedFromStorage(uploadParams.current.file.fileMd5);
      const chunks = uploadParams.current.chunks
        .map(item => {
          if(!uploadedChunks[item.chunk]) {
            item.status = 'pending';
          }
          return item;
        });
      const data = {
        Total: uploadParams.current.file.fileChunks,
        Uploaded: Object.keys(uploadedChunks).length,
        chunks
      };
      console.log(data);
      
      filterChunk(data);
    }
  }, [filterChunk]);


  return {
    onUpload,
    uploadPercent: state.uploadPercent,
    preUploadPercent: state.preUploadPercent,
    preUploading: state.preUploading,
    uploadRequest: state.uploadRequest,
    uploaded: state.uploaded,
    stopUpload,
    uploadProps: {
      onRemove,
      fileList: state.fileList,
      beforeUpload
    }
  }
}

export default useFileUpload;