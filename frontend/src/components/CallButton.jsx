import React from "react";

const CallButton = ({ onStartCall }) => {
  return <button onClick={onStartCall} 
  className="bg-green-500 text-white px-4 py-2 rounded-2xl shadow-md hover:bg-green-600 transition"
  >Start Call</button>;
};

export default CallButton;
