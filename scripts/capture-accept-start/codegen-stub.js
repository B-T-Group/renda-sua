import React from 'react';

export default function codegenNativeComponent(name) {
  return function NativeStub(props) {
    const label = String(name ?? '');
    const style = label.includes('SafeArea')
      ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100vh' }
      : { display: 'contents' };
    return React.createElement('div', { style }, props.children);
  };
}
