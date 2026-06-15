import React, { Component } from 'react';
import ribbon from './ribbon';


class App extends Component {
  constructor(props) {
    super(props)
    window.ribbon = ribbon;
  }

  render() {
    return (
      <div>
        link-bind
      </div>
    )
  }
}

export default App;
