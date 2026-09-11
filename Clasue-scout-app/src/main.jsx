import React from 'react'
import ReactDOM from 'react-dom/client'
import './local-ui.css'
// import App from './frc-scout-app-FireB.jsx' //For Online DataBase Saving(FireBase)
import App from './frc-scout-local.jsx' //For Local File Saving (Self Hosting)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
