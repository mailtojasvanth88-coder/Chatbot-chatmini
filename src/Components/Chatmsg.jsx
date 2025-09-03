import React from 'react';
import './Body.css'

const Chatmsg = ({ messages }) => {
  return (
    <div id="chatbox" >
      {messages.map((msg, index) => (
        <div key={index} >
          {msg.user ? (
            <span className='userchat'>  
              <span >{msg.message}</span>
              <i className="fa-solid fa-user"></i>
            </span>
          ) : (
            <span className='botchat'>
              <i className="fa-solid fa-robot" ></i>
              <span>{msg.message}</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default Chatmsg;
