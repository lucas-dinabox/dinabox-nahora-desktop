// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, Notification, webContents, session, Tray, Menu } = require('electron')
const axios = require('axios');
const path = require('path');
const Store = require('electron-store');

let tray;
let mainWindow;
let store = new Store();

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
        }
    })

    mainWindow.loadFile('index.html');
    mainWindow.webContents.openDevTools();

    session.defaultSession.clearStorageData();
}

app.on('ready', () => {
    createWindow();
    app.setAppUserModelId('com.example.myapp');
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


// store.set(1 + '/' + 'checkin', false);
// store.set(2 + '/' + 'checkin', false);
// store.set(1 + '/' + 'checkout', false);
// store.set(2 + '/' + 'checkout', false);

ipcMain.on('getUser', (event, data) => {

    function notification(title, body) {
        if (!Notification.isSupported()) return;

        const notification = new Notification({
            title: title,
            body: body,
            icon: path.join(__dirname, 'clock.png'),
            timeoutType: 'never',
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

        const url = `https://testeonline.adiantibuilder.com.br/lucasaraujodossantosdev/ponto_producao/employee_search/user_id/`;

        axios.get(url, config)
            .then(response => {
                const currentTime = Date.now();
                let shifts = response.data;
                let innerData = shifts.data.data;
                let checkinIsChecked = shifts.data.checkin.checkinIsChecked;
                let checkoutIsChecked = shifts.data.checkout.checkoutIsChecked;
                checkinIsChecked.forEach((checkin, index) => {
                    //console.log('Checkin Data: ' + index , checkin);
                    innerData[index]['checkin_is_checked'] = checkin[Object.keys(checkin)[0]];
                })
                checkoutIsChecked.forEach((checkout, index) => {
                    //console.log('Checkin Data: ' + index , checkin);
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
                                console.log(`Check in done`)
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
                                    // só exibir a notificação caso ele esteja dentro do intervalo de tempo entre o horario de começo até a saída
                                    // if (data.class !== "SetCheckinMVC&method=onShow") {
                                    //     notification('Faça checkin', "Turno " + shift.name + " " + shift.checkin).show();
                                    // }
                                    // else {
                                    //     console.log('Resultado before: ', store.get(shift.id + '/' + 'checkin'));
                                    //     if (store.get(shift.id + '/' + 'checkin') !== true) {
                                    //         store.set(shift.id + '/' + 'checkin', true);
                                    //         console.log('Resultado afther: ', store.get(2 + '/' + 'checkin'));
                                    //         notification('Faça checkin', "Turno " + shift.name + " " + shift.checkin).show();
                                    //     }
                                    // }
                                    // if (store.get(shift.id + '/' + 'checkin') !== true) {
                                    //     store.set(shift.id + '/' + 'checkin', true);
                                    //     console.log('Resultado afther: ', store.get(shift.id + '/' + 'checkin'));
                                    //     notification('Faça checkin', "Turno " + shift.name + " " + shift.checkin).show();
                                    // }
                                    // console.log('Resultado afther: ', store.get(shift.id + '/' + 'checkin'));
                                    // console.log(`Check in the ${shift.checkin} hours of the ${shift.name} shift`)
                                    // if (data.class !== "SetCheckinMVC&method=onShow") {
                                    //     notification('Faça checkin', "Turno " + shift.name + " " + shift.checkin).show();
                                    // }
                                    notification('Faça checkin', "Turno " + shift.name + " " + shift.checkin).show();
                                }
                            }
                        }
                        else {
                            console.log(`Next checkin at ${shift.checkin} hours with ${shift.tolerance} minutes tolerance`);
                        }

                        // Logica para o checkout
                        if (currentTime > (startTimeCheckout + tolerance)) {
                            //console.log("Perdeu o checkout " + shift.checkout)
                        }
                        else if (currentTime > startTimeCheckout && currentTime <= (startTimeCheckout + tolerance)) {
                            //event.sender.send("reload-page", true);

                            // if (store.get(shift.id + '/' + 'checkout') !== true) {
                            //     store.set(shift.id + '/' + 'checkout', true);
                            //     console.log('Resultado afther: ', store.get(shift.id + '/' + 'checkin'));
                            //     notification('Faça checkout', "Turno " + shift.name + " " + shift.checkout).show();
                            // }

                            notification('Faça checkout', "Turno " + shift.name + " " + shift.checkout).show();
                            console.log(`Checkout in the ${shift.checkout} hours of the ${shift.name} shift`)
                        }
                        else {
                            //console.log("Ainda não passou da hora do checkout " + shift.checkout)
                        }
                    }
                });

            })
            .catch(error => {
                //console.log(error);
            });
    }
    getShifts(data.user);
    //console.log(data);
});

app.on('before-quit', () => {
    tray.destroy()
})