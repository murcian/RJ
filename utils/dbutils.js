var dbutils = {};
/**
 * Funcion que obtiene la informacion del usuario y la comprueba.
 * @param {string} url: url a la que se enviará la información.
 * @param {array} loginData: conjunto de datos que se enviarán al servidor.
 * @param {Object} i18n: modelo que contiene los textos de la aplicación.
 * @param {function} callback: función de retorno.
 */
dbutils.doApiPOSTLogin = function (url, loginData, i18n, callback) {

	var msg = i18n.getText("msgLoginError");

	$.ajax({
		url: url,
		type: 'POST',
		contentType: 'application/json',
		async: true,
		data: JSON.stringify(loginData),
		dataType: 'json',

		success: function (data) {
			
			if (!data.hasOwnProperty("email")){
				
				utils.destroyPopupWithTimeoutAndRedirectToSFSF( utils.generatePopupInvalidCredentials(), 3000);

			}
			
			if (callback) {
				callback(data);
			}
		},

		error: function (jqXHR, textStatus, error) {
			msg = error;
			utils.showErrorMessage(msg);
		}

	});

};
/**
 * Función que realiza las llamadas a la base de datos.
 * @param {string} url: url destino sobre la que realizamos la llamada.
 * @param {array} postData: conjunto de datos enviados al servidor.
 * @param {Object} i18n: modelo que contiene los textos de la aplicación.
 * @param {function} callback: función de retorno a la que se llama si el servidor no devuelve error.
 */
dbutils.DBPost = function (url, postData, i18n, callback) {

	var urlStr = constants.api["url" + dbutils.getEnvironment()] + url,
		expireDate = new Date(localStorage.getItem("expireCookie")).getTime(),
		today = new Date().getTime(),
		msg = i18n.getText("msgServerError"),
		msgSession = i18n.getText("msgSessionExpired");
		
		postData.token = sessionStorage.getItem('token');
		postData.user = sessionStorage.getItem('email');

	/*	if (postData.hasOwnProperty("controlVariables")) {
			postData["controlVariables"] = null;
		}
		if (postData.hasOwnProperty("customText")) {
			postData["customText"] = null;
		}
		if (postData.hasOwnProperty("parameters")) {
			postData["parameters"] = null;
		}*/

	if (expireDate > today) {
		$.ajax({
			url: urlStr,
			dataType: "JSON",
			type: "POST",
			async: true,
			data: JSON.stringify(postData),
			contentType: 'application/json',
			complete: function (xhr) {
				//token = xhr.getResponseHeader("X-CSRF-Token");
			},
			success: function (response) {
				if (response.hasOwnProperty("error")){
					
					utils.destroyPopupWithTimeoutAndRedirectToSFSF( utils.generatePopupInvalidCredentials(), 3000);

				}
				if (callback) {
					callback(response);
				}
			},
			error: function (error) {
				/* INI LZ 23-01-2020 añadida lógica para controlar los errores de timeout del login
				Antiguo:
				msg += error.responseText.split(":")[3];
				utils.showErrorMessage(msg);
				
				Nuevo: */

				if (error.getResponseHeader('x-cnection') === 'close' && error.status < 500) {
					alert("Session is expired, page shall be reloaded.");
					window.location.reload();
				} else {
					msg += error.responseText.split(":")[3];
					utils.showErrorMessage(msg);
				}
				/* FIN LZ 23-01-2020 */
			}
		});
	} else {
		utils.showErrorMessage(msgSession);
		cookies.eraseCookie('expireCookie');
	}
};

/**
 * Función que realiza las llamadas a la base de datos.
 * @param {string} url: url destino sobre la que realizamos la llamada.
 * @param {array} postData: conjunto de datos enviados al servidor.
 * @param {Object} i18n: modelo que contiene los textos de la aplicación.
 * @param {function} callback: función de retorno a la que se llama si el servidor no devuelve error.
 */
dbutils.DBPostCSV = function (url, postData, i18n, callback) {
	var urlStr = constants.api["urlProcessing"] + url,
		expireDate = new Date(localStorage.getItem("expireCookie")).getTime(),
		today = new Date().getTime(),
		msg = i18n.getText("msgServerError"),
		msgSession = i18n.getText("msgSessionExpired");

	if (postData.hasOwnProperty("controlVariables")) {
		postData["controlVariables"] = null;
	}
	if (postData.hasOwnProperty("customText")) {
		postData["customText"] = null;
	}
	if (postData.hasOwnProperty("parameters")) {
		postData["parameters"] = null;
	}

	if (expireDate > today) {
		$.ajax({
			url: urlStr,
			dataType: "text",
			type: "POST",
			async: true,
			data: JSON.stringify(postData),
			contentType: 'application/json',
			complete: function (xhr) {
				//token = xhr.getResponseHeader("X-CSRF-Token");
			},
			success: function (response) {
				if (callback) {
					callback(response);
				}
			},
			error: function (error) {
				//msg += error.responseText.split(":")[3];
				utils.showErrorMessage(msg);
			}
		});
	} else {
		utils.showErrorMessage(msgSession);
	}
};

/**
 * Función que comprueba la conexión al cambiar de pantalla o recargar la página. Permite persistencia
 * en los datos y evita que se acceda a las distintas páginas sin estar logeado.
 * @param {Object} oRouter: componente de navegación para moverse entre pantallas.
 * @param {Object} i18n: modelo que contiene los textos de la aplicación.
 * @param {string} viewId: identificador de la vista desde la que se realiza la llamada.
 * @param {Object} that: Referencia a la vista.
 * @param {function} callback: función de retorno a la que se llama si el servidor no devuelve error.
 */
dbutils.checkConnection = function (oRouter, i18n, viewId, that, callback) {

	var data,
		expireDate = new Date(localStorage.getItem("expireCookie")).getTime(),
		today = new Date().getTime(),
		url = constants.api["url" + dbutils.getEnvironment()] + constants.api.urlloginCheck,
		urlParameters = constants.api.urlGetParameterization,
		postData = {};

	if (sap.ui.getCore().getModel("userSessions") === undefined) {
		data = cookies.getCookie("userData");
		if (data === null || expireDate < today) {
			oRouter.navTo("login");
		} else {
			dbutils.doApiPOSTLogin(url, data, i18n, function (response) {
				postData.idcompany = response.idcompany;
				dbutils.DBPost(urlParameters, postData, i18n, function (parameters) {
					sap.ui.require(["sap/ui/model/json/JSONModel"], function (JSONModel) {
						utils.prepareGlobalParameters(parameters, that, JSONModel);
						if (sap.ui.getCore().getModel("userSessions") === undefined) {
							sap.ui.getCore().setModel(new JSONModel(response), "userSessions");
						} else {
							sap.ui.getCore().getModel("userSessions").setData(data);
						}
						sap.ui.getCore().byId(viewId + "--customHeader--avatarlog").setSrc("data:image/png;base64," + sap.ui.getCore().getModel("userSessions").getData().photo);
						sap.ui.getCore().byId(viewId + "--customHeader--avatarlog").setTooltip(sap.ui.getCore().getModel("userSessions").getData().employeename +
							" " + (sap.ui.getCore().getModel("userSessions").getData().employeelastname));
						sap.ui.getCore().byId(viewId + "--customHeader--companyLogo").setTooltip(sap.ui.getCore().getModel("userSessions").getData().companyname);
						sap.ui.getCore().byId(viewId + "--customHeader--employeeInfo").setText(sap.ui.getCore().getModel("userSessions").getData().employeename +
							" " +
							sap.ui.getCore().getModel("userSessions").getData().employeelastname);
						callback();
					});
				});
			});
		}
	} else {
		sap.ui.getCore().byId(viewId + "--customHeader--avatarlog").setSrc("data:image/png;base64," + sap.ui.getCore().getModel("userSessions").getData().photo);
		sap.ui.getCore().byId(viewId + "--customHeader--avatarlog").setTooltip(sap.ui.getCore().getModel("userSessions").getData().employeename +
			" " + (sap.ui.getCore().getModel("userSessions").getData().employeelastname));
		sap.ui.getCore().byId(viewId + "--customHeader--companyLogo").setTooltip(sap.ui.getCore().getModel("userSessions").getData().companyname);
		sap.ui.getCore().byId(viewId + "--customHeader--employeeInfo").setText(sap.ui.getCore().getModel("userSessions").getData().employeename +
			" " + sap.ui.getCore().getModel("userSessions").getData().employeelastname);
		callback();
	}

};
/**
 * Función que comprueba y devuelve el entorno en el que se ejecuta la aplicación
 * @returns {string}: cadena que representa el entorno (desarrollo, integración...)
 */
dbutils.getEnvironment = function () {
	return "Dev"
};