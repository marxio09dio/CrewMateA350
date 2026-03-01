import React from "react"
import ReactDOM from "react-dom/client"

import { TakeoffWindow } from "./TakeoffWindow"
import "../../App.css"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TakeoffWindow />
  </React.StrictMode>
)
