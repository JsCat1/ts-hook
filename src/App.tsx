import React from 'react';
import { Spin, Progress, Upload, Button, Icon } from 'antd';
import './App.css';
import useFileUpload from './hook/useFileUpload';
// import useThrottle from './hook/useThrottle';
// import useDebounce from './hook/useDebounce';

const url = 'http://47.96.80.210:8080/upload';
const { Dragger } = Upload;
// const uploadBeforeMethod = url => params => {
//   // 处理需要的参数
//   const _params = params;
//   return fetch(url, {
//     body: _params
//   })
//   .then(res => res.json)
//   .then(data => {
//     if (!data.status) {
//       throw data.msg;
//     }
//     // 转换useFileUpload所需要的数据格式
//     /* 
//       Chunks:[
//               {
//                 chunk: 1, 
//                 chunkMd5:"8770f43dc59effdc8b995e4aacc8a26c", 
//                 fileMd5:"f5aeec69076483585f4f672223265c0c",
//                 end: 5242880,
//                 start:0,
//                 status:"pending"
//               },
//               …
//             ],
//             Code:200,
//             FileMd5:"f5aeec69076483585f4f672223265c0c"
//             MaxThreads:1,
//             Message:"OK",
//             Total:119,
//             Uploaded:0
//     */
//     // 格式可能是如上所示
//     const _data = data.result;
//     return _data;
//   })
//   .catch(err => err);
// };
const uploadFormatParams = ({file, blob, fileInfo}: any) => {
  let formData = new FormData(),
      // 新建一个blob对象，将对应分片的arrayBuffer加入Blob中
      _blob = new Blob([blob], { type: 'application/octet-stream' });
  // 将生成的blob塞入到formData中传入服务端
  formData.append('file', _blob);
  formData.append('type', 'application/octet-stream');
  formData.append('size', file.size);
  formData.append('lastModifiedDate', file.lastModifiedDate);
  formData.append('md5', file.fileMd5);
  formData.append('name', file.name);
  formData.append('id', file.uid);
  formData.append('chunk', fileInfo.chunk);
  formData.append('chunks', fileInfo.chunks);
  return formData;
}

const App = () => {
  const { 
    uploadProps, 
    stopUpload,
    preUploading,
    preUploadPercent,
    uploadPercent,
    uploaded,
    uploadRequest,
    onUpload
  } = useFileUpload(url, uploadFormatParams);
  const tip = (
    <div>
      <h3 style={{margin:'10px auto',color:'#1890ff'}}>文件预处理中...</h3>
      <Progress width={80} percent={preUploadPercent} type="circle" status="active" />
    </div>
  ) as any;
  return (
    <div className="content-inner">
        <Spin 
          tip={tip} 
          spinning={preUploading} 
          style={{ height: 350 }}
        >
          <div style={{ marginTop: 16, height: 250 }}>
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <Icon type="inbox" />
              </p>
              <p className="ant-upload-text">点击或者拖拽文件进行上传</p>
              <p className="ant-upload-hint">Support for a single or bulk upload. Strictly prohibit from uploading company data or other band files</p>
            </Dragger>
            { uploadPercent >= 0 && !uploaded && (
              <div style={{marginTop:20, width:'95%'}}>
                <Progress percent={uploadPercent} status="active" />
                <h4>文件上传中，请勿关闭窗口</h4>
              </div>
            )}
            { !!uploadRequest && <h4 style={{color:'#1890ff'}}>上传请求中...</h4> }
            { !!uploaded && <h4 style={{color:'#52c41a'}}>文件上传成功</h4> }
            <Button type="primary" onClick={onUpload} disabled={!!(preUploadPercent < 100)}>
              <Icon type="upload" />提交上传
            </Button>
            <Button onClick={stopUpload} type="danger">暂停</Button>
          </div>
        </Spin>
      </div>
  );
}

export default App;
