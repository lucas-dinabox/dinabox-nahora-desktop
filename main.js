// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, Notification, webContents, session, Tray, Menu } = require('electron')
const axios = require('axios');
const path = require('path');
const { localStorage, sessionStorage } = require('electron-browser-storage');


let mainWindow;
let tray;

function createWindow() {
    // Create the browser window.
    //const mainWindow = new BrowserWindow({
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'clock.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webviewTag: true,
            devTools: false,
        }
    })

    mainWindow.loadFile('index.html');
    //mainWindow.webContents.openDevTools();

    session.defaultSession.clearStorageData();
}

app.on('ready', () => {
    createWindow();
    app.setAppUserModelId(' ');
    // Cria um ícone de bandeja para o aplicativo
    tray = new Tray(path.join(__dirname, 'clock.png'));

    // menu supenso de opções
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Sair', type: 'normal', click: function () {
                //console.log('Fechar');
                //app.isQuiting = true;
                //app.quit();
                session.defaultSession.clearCache();
                app.exit();
            }
        }
    ])
    tray.setToolTip('NaHora');
    tray.setContextMenu(contextMenu);
    // Adiciona um clique com botão direito ao ícone da bandeja para mostrar opções
    tray.on('right-click', () => {
        tray.popUpContextMenu();
    });

    // Adiciona um clique duplo ao ícone da bandeja para mostrar a janela
    tray.on('double-click', () => {
        mainWindow.show();
    });

    // Esconde a janela quando o botão fechar é clicado
    mainWindow.on('close', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });

    mainWindow.on('close', (event) => {
        event.preventDefault();
        //console.log("Window close event captured");
        mainWindow.hide();
    });
});

ipcMain.on('getUser', (event, data) => {
    function notification(title, body) {
        if (!Notification.isSupported()) return;

        const notification = new Notification({
            title: title,
            body: body,
            icon: path.join(__dirname, 'clock.png'),
            timeoutType: 'never',
            actions: [],
        });

        notification.on('click', () => {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.show();
            event.sender.send("redirectToCheckin", true);
        });

        return notification;
    }


    function getShifts(id) {
        let token = "Bearer " + id;
        let config = {
            headers: {
                'Authorization': token
            }
        };

        const url = `https://www.ead.dinabox.net/app/rest.php?class=GetEmployeeShifts&method=searchByUserId`;

        axios.get(url, config)
            .then(response => {
                const currentTime = Date.now();
                let shifts = response.data;
                let innerData = shifts.data.data;
                let checkinIsChecked = shifts.data.checkin.checkinIsChecked;
                let checkoutIsChecked = shifts.data.checkout.checkoutIsChecked;
                checkinIsChecked.forEach((checkin, index) => {
                    innerData[index]['checkin_is_checked'] = checkin[Object.keys(checkin)[0]];
                })
                checkoutIsChecked.forEach((checkout, index) => {
                    innerData[index]['checkout_is_checked'] = checkout[Object.keys(checkout)[0]];
                })
                event.sender.send("shiftData", innerData);
                innerData.forEach(shift => {
                    if (shift) {

                        let startTimeCheckin = Date.parse(`${new Date().toISOString().slice(0, 10)} ${shift.checkin}`); // horário para entrada
                        let startTimeCheckout = Date.parse(`${new Date().toISOString().slice(0, 10)} ${shift.checkout}`); // horário para entrada
                        let tolerance = shift.tolerance * 60 * 1000;

                        // Logica para o checkin 
                        if (currentTime > startTimeCheckin) {
                            if (shift.checkin_is_checked) {
                                console.log(`Check in done`);
                                localStorage.setItem(shift.id + ',' + 'checkin', true);
                            }
                            else {

                                // turno em segundos
                                var dataEntrada = new Date(startTimeCheckin);
                                var dataSaida = new Date(startTimeCheckout);

                                var shiftCountdown = (dataSaida.getTime() - dataEntrada.getTime()) / 1000;
                                //console.log('Turno : ', shiftCountdown); // resultado da diff entre a hora atual e checkin com tolerancia em segundos

                                // recuperar tempo passado da hora do checkin
                                var now = new Date();
                                var checkinWithTolerance = new Date(startTimeCheckin + tolerance);
                                var countdown = (now.getTime() - checkinWithTolerance.getTime()) / 1000;
                                //console.log('RESULTADO: ', countdown); // resultado da diff entre a hora atual e checkin com tolerancia em segundos

                                // mostra a notificação?
                                if (countdown > shiftCountdown) {
                                    console.log('Perdeu checkin');
                                }
                                else {
                                    console.log("Faça seu checkin!");
                                    mainWindow.webContents.executeJavaScript(`window.localStorage.getItem('${shift.id},checkin')`).then((response) => {
                                        if (response == 'false') {
                                            notification('Faça checkin', "Turno " + shift.name + " " + shift.checkin).on('click', () => { localStorage.setItem(shift.id + ',' + 'checkin', true); }).show();
                                        }
                                    });
                                }
                            }
                        }
                        else {
                            console.log(`Next checkin at ${shift.checkin} hours with ${shift.tolerance} minutes tolerance`);
                        }

                        // Logica para o checkout
                        if(shift.checkout_is_checked){
                            console.log(`Checkout in done`);
                            localStorage.setItem(shift.id + ',' + 'checkout', true);
                        }
                        else{
                            if (currentTime > (startTimeCheckout + tolerance)) {
                                //console.log("Perdeu o checkout " + shift.checkout)
                            }
                            else if (currentTime > startTimeCheckout && currentTime <= (startTimeCheckout + tolerance)) {
    
                                console.log(`Checkout in the ${shift.checkout} hours of the ${shift.name} shift`);
                                mainWindow.webContents.executeJavaScript(`window.localStorage.getItem('${shift.id},checkout')`).then((response) => {
                                    if (response == 'false') {
                                        notification('Faça checkout', "Turno " + shift.name + " " + shift.checkout).on('click', () => { localStorage.setItem(shift.id + ',' + 'checkout', true); }).show();
                                    }
                                });
                            }
                            else {
                                console.log(`Next checkout at ${shift.checkout} hours with ${shift.tolerance} minutes tolerance`);
                            }
                        }
                    }
                });

            })
            .catch(error => {
                //console.log('erro requisição: ', error);
            });
    }
    getShifts(data.user);
});

app.on('before-quit', () => {
    tray.destroy()
})