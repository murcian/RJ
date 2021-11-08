sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
	"use strict";

	var autoLogFailed = false;
	
	return Controller.extend("epicfichajes.epicfichajes.controller.login", {

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf epicfichajes.epicfichajes.view.login
		 */
		onInit: function () {
			
			var that = this;
			this.oRouter = sap.ui.core.UIComponent.getRouterFor(this); //Componente de navegación
			/**
			 * detect IE
			 * returns version of IE or false, if browser is not Internet Explorer
			 */
			function detectIE() {
			  var ua = window.navigator.userAgent;
			
			  // Test values; Uncomment to check result …
			
			  // IE 10
			  // ua = 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; Trident/6.0)';
			  
			  // IE 11
			  // ua = 'Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko';
			  
			  // Edge 12 (Spartan)
			  // ua = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36 Edge/12.0';
			  
			  // Edge 13
			  // ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586';
			
			  var msie = ua.indexOf('MSIE ');
			  if (msie > 0) {
			    // IE 10 or older => return version number
			    return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
			  }
			
			  var trident = ua.indexOf('Trident/');
			  if (trident > 0) {
			    // IE 11 => return version number
			    var rv = ua.indexOf('rv:');
			    return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
			  }
			
			  var edge = ua.indexOf('Edge/');
			  if (edge > 0) {
			    // Edge (IE 12+) => return version number
			    return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
			  }
			
			  // other browser
			  return false;
			}

			var version = detectIE();
			
			if (version < 12 && version) { // Es internet explorer
				sap.ui.core.UIComponent.getRouterFor(that).navTo("noSupportedIE");
			} else {
				sap.ui.core.UIComponent.getRouterFor(that).getRoute("login").attachPatternMatched(this.initPattern, this);
				sap.ui.core.UIComponent.getRouterFor(that).getTarget("login").attachDisplay(jQuery.proxy(this.handleRouteMatched, this));
			}
			
		},

		/**
		 * Bindea el método al evento de pulsar la tecla Enter
		 */
		onAfterRendering: function () {
			var inputUser = this.getView().byId("inputUser");
			var inputPassword = this.getView().byId("inputPassword");
			var that = this;

			inputUser.onkeydown = function (evt) { //13 = intro
				if (evt.keyCode === 13) {
					that.doLogin();
				}
			};

			inputPassword.onkeydown = function (evt) { //13 = intro
				if (evt.keyCode === 13) {
					that.doLogin();
				}
			};
		},

		/**
		 * Función que llamada cada vez que se accede a la vista para inicializar los datos del form.
		 */
		initPattern: function () {

			var oModel = new sap.ui.model.json.JSONModel(),
				oView = this.getView();

			oView.setBusyIndicatorDelay(0);
			oView.setBusy(true);
			cookies.eraseCookie("userData");
			localStorage.removeItem("expireCookie");

			oModel.loadData("/services/userapi/currentUser");

			this.inputUser = this.getView().byId("inputUser");
			this.inputPassword = this.getView().byId("inputPassword");
			this.loginButton = this.getView().byId("loginButtonId");
			sap.ui.getCore().stepsModel = "";
			this.getUserSAML();

		},

		getUserSAML: function () {
			var oModel = new sap.ui.model.json.JSONModel();
			this.getView().setModel(oModel);
			this.loadModel(this.getView().getModel(), this);
		},

		loadModel: function (model, context) {

			model.attachRequestCompleted(function () {
				sap.ui.getCore().SAMLUser = model.getData();
				if (sap.ui.getCore().SAMLUser.hasOwnProperty("email") || sap.ui.getCore().SAMLUser.hasOwnProperty("name")) {
					context.doLogin(context);
				} else {
					context.getView().setBusy(false);
				}
			});
			model.loadData("/services/userapi/currentUser");

		},
		/**
		 * Función que impide que se navegue a otra vista que no sea el dashboard.
		 * param {Object} oEvent: objeto que llama a esta función.
		 */
		handleRouteMatched: function (oEvent) {
			if (oEvent.getParameter('config').name !== "home") {
				return;
			}
		},
		/**
		 * Función que recoge los datos de logeo introducidos.
		 */
		doLogin: function (context) {

			var token = "",
				//msg = this.getView().getModel("i18n").getResourceBundle().getText("msgLoginError"),
				device = "",
				user = this.inputUser.getValue(),
				mode,
				password = this.inputPassword.getValue(),
				oModelData = this.getView().getModel().getData();

			/* Get token for android */
			if (window.JavaScriptInterfacePush) {
				token = window.JavaScriptInterfacePush.getStringFromJS(user);
				device = "android";
			}

			if (oModelData.hasOwnProperty("email") && !autoLogFailed) {
				user = oModelData.email;
				mode = "SAML";
			} else if (oModelData.hasOwnProperty("name") && !autoLogFailed) {
				user = oModelData.name;
				mode = "SAML";
			} else {
				user = this.inputUser.getValue();
				mode = "APP";
			}
			
			this.doLoginCheck(user, password, token, device, mode, context);
		},
		/**
		 * Función que prepara los datos de logeo para mandarlos al servidor para su comprobación.
		 * @param {string} user: usuario introducido.
		 * @param {string} password: contraseña introducida.
		 * @param {string} token: token de dispositivo.
		 * @param {string} device: tipo de dispositivo.
		 * @param {function} callback: función de retorno.
		 */
		doLoginCheck: function (user, password, token, device, mode, context) {
			var lang = sap.ui.getCore().getConfiguration().getLanguage(),
				msg = this.getView().getModel("i18n").getResourceBundle().getText("msgLoginError"),
				that = this,
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				url = constants.api["url" + dbutils.getEnvironment()] + constants.api.urlloginCheck,
				postData = {},
				login = {
					user: user,
					password: password,
					tokenPush: token,
					token: utils.findGetParameter("token"),      
					device: device,
					mode: mode
				};

			if (lang.length > 2) {
				lang = lang.split("-")[0];
			}

			url += "?lang=" + lang;

			/* Accessing animation */
			this.accessing();

			/* Check user credentials */
			dbutils.doApiPOSTLogin(url, login, i18n, function (data) {
				console.log(data);
				postData.idcompany = data.idcompany;
				data.token = login.token;
				if (data.hasOwnProperty("email")) {
					cookies.setCookie('userData', login);
					if (sap.ui.getCore().getModel("userSessions") === undefined) {
						sap.ui.getCore().setModel(new JSONModel(data), "userSessions");
					} else {
						sap.ui.getCore().getModel("userSessions").setData(data);
					}
					that.oRouter.navTo("home");
					
					sessionStorage.setItem('token', data.token);
					sessionStorage.setItem('email', data.email);
					
				} else {
					if(data.error.indexOf("LOGINATTEMPTS") !== -1) {
						utils.showErrorMessage("Se ha producido un error: El usuario ha sido bloqueado por múltiples intentos fallidos");
					} else {
						utils.showErrorMessage("Se ha producido un error: Las credenciales no son válidas");
					}
					autoLogFailed = true;
					try {
						context.getView().setBusy(false);
					} catch (e) {
						//console.log("error log");
					}
				}
				that.notAccessing();
			});

		},
		/**
		 * Función que cambia el estado del botón de acceso
		 */
		accessing: function () {

			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();

			this.loginButton.setText(i18n.getText("access"));
			this.loginButton.setIcon("sap-icon://synchronize");

		},
		/**
		 * Función que cambia el estado del botón de acceso
		 */
		notAccessing: function () {

			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();

			this.loginButton.setText(i18n.getText("entrar"));
			this.loginButton.setIcon("");

		},
		/** 
		 * Función que permite ver la contraseña en texto plano o volver a ocultarla.
		 */
		showPassword: function () {

			if (this.getView().byId("inputPassword")._getInputValue() !== "") {
				if (this.getView().byId("inputPassword").getType() === "Password") {
					this.getView().byId("inputPassword").setType("Text");
				} else {
					this.getView().byId("inputPassword").setType("Password");
				}
			}

		},
		/**
		 */
		forgotPass: function () {}

	});

});