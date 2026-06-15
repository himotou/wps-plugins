import React, { Component } from 'react';
import './dialog.css';

class HyperlinkDialog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectionText: '',
      linkText: '',
      url: '',
      title: '',
      mode: 'cursor'
    };
  }

  componentDidMount() {
    const context = this.getContext();
    if (!context) {
      return;
    }

    const initialText = context.text || '';
    const initialUrl = context.url || '';
    const initialTitle = context.screenTip || initialUrl || '';
    const initialLinkText = context.mode === 'selection' ? initialText : '';

    this.setState({
      selectionText: initialText,
      linkText: initialLinkText,
      url: initialUrl,
      title: initialTitle,
      mode: context.mode || 'cursor'
    });
  }

  getContext = () => {
    try {
      const raw = window.Application.PluginStorage.getItem('link_bind_context');
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('读取选区上下文失败:', error);
      return null;
    }
  }

  handleConfirm = () => {
    const { url, linkText, title, mode } = this.state;

    if (mode !== 'selection') {
      alert('当前没有选中文字，请先选择要设置超链接的文本。');
      return;
    }

    if (!url.trim()) {
      alert('请输入超链接地址');
      return;
    }

    const success = window.ribbon.applyHyperlink({
      url: url.trim(),
      text: linkText,
      title: title.trim() || url.trim()
    });

    if (success) {
      try {
        window.close();
      } catch (error) {
        console.log('关闭窗口失败:', error);
      }
    }
  }

  handleCancel = () => {
    try {
      window.close();
    } catch (error) {
      console.log('关闭窗口失败:', error);
    }
  }

  render() {
    const { selectionText, linkText, url, title, mode } = this.state;
    const hasSelection = mode === 'selection';

    return (
      <div className="hyperlinkDialogPage">
        <div className="hyperlinkDialogHeader">
          <h2>链接绑定</h2>
          <p>
            {hasSelection
              ? '确认后会把链接写回当前选中的文字；如果原来已有超链接，会先带出原链接。'
              : '当前没有选中文字。'}
          </p>
        </div>

        <div className="hyperlinkPanel">
          <div className="hyperlinkField">
            <label>当前选中文本</label>
            <div className="hyperlinkReadonly">{selectionText || '当前没有选中文字'}</div>
          </div>

          <div className="hyperlinkField">
            <label>写入文字</label>
            <input
              type="text"
              value={linkText}
              onChange={(event) => this.setState({ linkText: event.target.value })}
              placeholder="请输入要显示的文字"
              disabled={!hasSelection}
            />
          </div>

          <div className="hyperlinkField">
            <label>超链接地址</label>
            <input
              type="text"
              value={url}
              onChange={(event) => this.setState({ url: event.target.value })}
              placeholder="https://example.com/resource"
              disabled={!hasSelection}
            />
          </div>

          <div className="hyperlinkField">
            <label>链接提示文字</label>
            <input
              type="text"
              value={title}
              onChange={(event) => this.setState({ title: event.target.value })}
              placeholder="鼠标悬停时展示的提示"
              disabled={!hasSelection}
            />
          </div>
        </div>

        <div className="hyperlinkFooter">
          <button className="secondaryBtn" onClick={this.handleCancel}>取消</button>
          <button className="primaryBtn" onClick={this.handleConfirm} disabled={!hasSelection}>确认</button>
        </div>
      </div>
    );
  }
}

export default HyperlinkDialog;
