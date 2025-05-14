import { app, BrowserWindow } from "electron";
import path from "path";
import { isDev } from "./util.js";

app.on("ready", () => {
  const mainwindow = new BrowserWindow({
    width: 1300,
    height: 800,
  });

  if (isDev()) {
    mainwindow.loadURL("http://localhost:3001");
  } else {
    mainwindow.setMenu(null);
    mainwindow.loadFile(
      path.join(app.getAppPath() + "/build-react/index.html"),
    );
  }
});
