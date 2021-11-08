var utils = {};
/**
 * Función que trata la información de los registros del empleado cuando llegan desde la BBDD
 * para que se muestren en el formato correcto.
 * @param {array} data: conjunto de datos a tratar.
 * @param {Object} i18n: modelo que contiene los textos de la aplicación.
 * @param {Object} Status JSONModel Status
 */
/**
 *  @jgalaber - 03/09/2020
 * - Añadido el parametro Status
 */
utils.treatRecordsFromDatabase = function (data, i18n, Status) {

	var i,
		recordenddate,
		endDate,
		recordinitdate,
		initDate,
		recordendtimecomp,
		splitenddate,
		splitendtime,
		splitinitdate,
		splitinittime;

	for (i = 0; i < data.length; i++) {

		if (data[i].recordenddate !== null) {
			recordenddate = data[i].recordenddate.split("-");
			recordendtimecomp = data[i].recordenddate.split("T");
			data[i].recordenddate = recordenddate[2].split("T")[0] + "/" + recordenddate[1] + "/" + recordenddate[0];
			if (recordendtimecomp[0].indexOf("-") !== 0 && data[i].recordendtime !== null) {
				splitendtime = data[i].recordendtime.split(":");
				splitenddate = data[i].recordenddate.split("/");
				endDate = new Date(splitenddate[2], (splitenddate[1] - 1), splitenddate[0], splitendtime[0].split("T")[1], splitendtime[1],
					splitendtime[2].split(".")[0]);
				data[i].recordendtime = utils.getOffset(endDate);
			} else {
				data[i].recordendtime = "";
			}
		}

		if (data[i].recordinitdate !== null) {
			recordinitdate = data[i].recordinitdate.split("-");
			data[i].recordorderdate = data[i].recordinitdate;
			data[i].recordinitdate = recordinitdate[2].split("T")[0] + "/" + recordinitdate[1] + "/" + recordinitdate[0];
			splitinittime = data[i].recordinittime.split(":");
			splitinitdate = data[i].recordinitdate.split("/");
			initDate = new Date(splitinitdate[2], (splitinitdate[1] - 1), splitinitdate[0], splitinittime[0].split("T")[1], splitinittime[1],
				splitinittime[2].split(".")[0]);
			data[i].recordinittime = utils.getOffset(initDate);
		}
		/**
		 *  @jgalaber - 03/09/2020
		 *	- Se ha movido al utils la funcionalidad de => Añadir campos de exceso de horas
		 *	- Se ha agregado a la lógica previamente existente que cuando el estado de la solicitud es aprobado
		 *		setear las horas excedidas a 0 (visualmente) y sumar el valor de las horas extras a las horas trabajadas.
		 *  ··· Start ···
		 */
		// Status
		data[i].approvalstatustxt = utils.getStatusById(data[i].approvalstatus, Status);

		//Hours
		if (data[i].totalexcesstime && data[i].approvalstatus !== 2) {
			data[i].totalexcesstimetxt = utils.secondsToHoursAndMinutes(data[i].totalexcesstime, i18n);
		} else {
			data[i].totalworkingtime = data[i].totalworkingtime + data[i].totalexcesstime;
			data[i].totalexcesstimetxt = utils.secondsToHoursAndMinutes(0, i18n);
		}
		/**
		 *  @jgalaber - 03/09/2020
		 *  ··· End ···
		 */

		//Tiempos en formato X horas Y minutos
		data[i].totalrestingtime = utils.secondsToHoursAndMinutes(data[i].totalrestingtime, i18n);
		data[i].totalworkingtime = utils.secondsToHoursAndMinutes(data[i].totalworkingtime, i18n);
		data[i].idstatus = parseFloat(data[i].idstatus);
	}

	//console.log(data);

};
/**
 * Función que trata la información de los registros del empleado antes de ser enviados a la BBDD para 
 * que se almacenen en el formato correcto. 
 * @param {array} data: conjunto de datos a tratar.
 */
utils.treatRecordsToDatabase = function (data) {

	var i;

	for (i = 0; i < data.length; i++) {
		//Fechas en formato DD/MM/YYYY
		var recordenddate = data[i].recordenddate.split("/"),
			recordinitdate = data[i].recordinitdate.split("/"),
			//Tiempo en formato X horas Y minutos
			restSeconds = data[i].totalrestingtime.split(" "),
			workSeconds = data[i].totalworkingtime.split(" ");
		//Fechas en formato YYYY-MM-DD
		data[i].recordenddate = recordenddate[2] + "-" + recordenddate[1] + "-" + recordenddate[0];
		data[i].recordinitdate = recordinitdate[2] + "-" + recordinitdate[1] + "-" + recordinitdate[0];
		//Tiempos en segundos
		data[i].totalrestingtime = restSeconds[0] * 60 * 60 + restSeconds[2] * 60;
		data[i].totalworkingtime = workSeconds[0] * 60 * 60 + workSeconds[2] * 60;

		try {
			data[i].startdate = data[i].startdate.split("T")[0];
		} catch (e) {
			//console.log(e);
		}

	}

};
/**
 * Función que trata la información de los registros diarios del empleado cuando llegan desde la BBDD 
 * para que se muestren en el formato correcto.
 * @param {array} data: conjunto de datos a tratar.
 * @param {Object} i18n: modelo que contiene los textos de la aplicación.
 */
utils.treatDailyRecordsFromDatabase = function (data, i18n) {

	var i,
		recordinitdate,
		datetimemomentDate,
		datetimemomentTime;

	for (i = 0; i < data.length; i++) {
		recordinitdate = data[i].recordinitdate.split("-"); //Fecha en formato YYYY-MM-DD
		datetimemomentDate = utils.stringifyDate(new Date(data[i].datetimemoment), 1);
		datetimemomentTime = data[i].datetimemoment.split("T")[1].substr(0, 8);
		data[i].datetimemoment = datetimemomentDate + " " + datetimemomentTime;
		data[i].recordinitdate = recordinitdate[2] + "/" + recordinitdate[1] + "/" + recordinitdate[0]; //Fecha en formato DD/MM/YYYY
		//Tipo de registro
		switch (data[i].idregtype) {
		case constants.regType.auto:
			data[i].idregtype = i18n.getText("regAuto");
			break;
		case constants.regType.manual:
			data[i].idregtype = i18n.getText("regManual");
			break;
		case constants.regType.edited:
			data[i].idregtype = i18n.getText("regEdited");
			break;
		}
		//Estado del registro
		switch (data[i].idstatus) {
		case constants.workDayState.working:
			data[i].idstatus = i18n.getText("sttWork");
			break;
		case constants.workDayState.resting:
			data[i].idstatus = i18n.getText("sttRest");
			break;
		case constants.workDayState.afterWorkDay:
			data[i].idstatus = i18n.getText("sttEnd");
			break;
		case constants.workDayState.beforeWorkDay:
			data[i].idstatus = i18n.getText("sttBeforeWork");
			break;
		}
	}

};
/**
 * Función que muestra un diálogo de confirmación con el título y los parámetros recibidos. 
 * @param {Object} that: referencia al controlador desde el que se llama ésta función.
 * @param {Object} i18n: modelo que contiene los textos de la aplicación.
 * @param {array} params: parámetros del diálogo:
 *	params.title:		Titulo del Dialog
 *	params.text:		Texto del Dialog
 *	params.order:		Parte del código a ejecutar por los botones
 *	params.successBtn:	Texto del botón Success (Guardar, aceptar...)
 *	params.exitBtn:		Texto del botón Exit (Cancelar, salir...)
 *	params.url:			Url (si la hubiera) a la que mandar datos
 *	params.postData:	Conjunto de datos (si los hubiera) a enviar
 * @param {Object} History: referencia al historial de navegación por la página
 * @param {function} callback: función de retorno
 * @param isEdit: indica si se ha llamado al dialogo desde la edición de fichajes
 */
utils.confirmDialog = function (that, i18n, params, History, callback) {

	var oHistory = History.getInstance(),
		sPreviousHash = oHistory.getPreviousHash(),
		successBtn = new sap.m.Button({
			text: params.successBtn,
			press: function () {
				//Editar Jornada - Guardar Cambios - Aceptar

				if (params.order === "editWorkDaySave") {
					dbutils.DBPost(params.url, params.postData, i18n, function () {
						if (sPreviousHash !== undefined) {
							window.history.go(-1);
						} else {
							that.oRouter.navTo("home", true);
						}
					});
				}
				//Editar Jornada - Descartar Cambios - Aceptar
				if (params.order === "editWorkDayCancel") {
					if (sPreviousHash !== undefined) {
						window.history.go(-1);
					} else {
						that.oRouter.navTo("home", true);
					}
				}
				dialog.close();
				dialog.destroy();
			}
		}),
		exitBtn = new sap.m.Button({
			text: params.exitBtn,
			press: function () {
				//Editar Jornada - Guardar Cambios - Cancelar
				if (params.order === "editWorkDaySave") {
					if (sPreviousHash !== undefined) {
						window.history.go(-1);
					} else {
						that.oRouter.navTo("home", true);
					}
				}
				dialog.close();
				dialog.destroy();
			}
		}),
		dialog;

	successBtn.addStyleClass("dialogBtn tlfncThemedButton");
	exitBtn.addStyleClass("dialogBtn tlfncThemedButton");

	dialog = new sap.m.Dialog({
		title: params.title,
		type: 'Message',

		content: new sap.m.Text({
			text: params.text
		}),

		beginButton: exitBtn,
		endButton: successBtn,

		afterClose: function () {
			dialog.destroy();
		}
	});

	dialog.open();

};
/**
 * Devuelve el parámetro pasado con el formato correcto para ser mostrado en el cronómetro 
 * @param {string} stopwatchComponent: número de horas, minutos o segundos a comprobar
 * @returns {string}: número de horas, minutos o segundos en formato "00"
 */
utils.stopwatchComponentFormat = function (stopwatchComponent) {

	return stopwatchComponent < 10 ? "0" + stopwatchComponent : stopwatchComponent;

};
/**
 * Transforma un objeto fecha en un string con el formato adecuado para su representación o manejo.
 * @param {Date} date: objeto fecha a transformar.
 * @param {integer} format: tipo de formato al que convertir la fecha:
 * 1: DD/MM/YYYY.
 * 2: YYYY-MM-DD.
 * @returns {string}: cadena de texto con la fecha en el formato deseado.
 */
utils.stringifyDate = function (date, format) {

	var day = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
	var month = (date.getMonth() + 1) < 10 ? "0" + (date.getMonth() + 1) : date.getMonth() + 1;
	var year = date.getFullYear();

	if (format === 1) {
		return day + "/" + month + "/" + year;
	}
	if (format === 2) {
		return year + "-" + month + "-" + day;
	}
};
/**
 * Función que devuelve el día de la semana al que pertenece una fecha dada.
 * @param {Date} date: objeto fecha a comprobar.
 * @returns {integer}: valor numérico entre 1 y 7 que se corresponde con el día de la semana de la fecha recibida por parámetro.
 */
utils.getWeekDay = function (date) {

	return date.getDay() === 0 ? 7 : date.getDay();
};
/** 
 * Función que calcula el primer día de la semana de una fecha dada.
 * @param {Date} date: objeto fecha a calcular.
 * @returns {Date}: objeto fecha del primer día de la semana.
 */
utils.getFirstDayOfWeek = function (date) {
	var nDays = utils.getWeekDay(date),
		day = date.getDate(),
		month = date.getMonth(),
		year = date.getFullYear();

	return new Date(year, month, day - (nDays - 1), 12, 0, 0);
};
/** 
 * Función que calcula el último día de la semana de una fecha dada.
 * @param {Date} date: objeto fecha a calcular.
 * @returns {Date}: objeto fecha del último día de la semana.
 */
utils.getLastDayOfWeek = function (date) {

	var nDays = utils.getWeekDay(date),
		day = date.getDate(),
		month = date.getMonth(),
		year = date.getFullYear();

	return new Date(year, month, day + (7 - nDays), 12, 0, 0);
};
/** 
 * Función que calcula el primer día del mes de una fecha dada.
 * @param {Date} date: objeto fecha a calcular.
 * @returns {Date}: objeto fecha del primer día del mes.
 */
utils.getFirstDayOfMonth = function (date) {

	var month = date.getMonth(),
		year = date.getFullYear();

	return new Date(year, month, 1, 12, 0, 0);
};
/** 
 * Función que calcula el último día del mes de una fecha dada.
 * @param {Date} date: objeto fecha a calcular.
 * @returns {Date}: objeto fecha del último día del mes.
 */
utils.getLastDayOfMonth = function (date) {

	var month = date.getMonth(),
		year = date.getFullYear();
	return new Date(year, month + 1, 0, 12, 0, 0);
};
/**
 * Función que devuelve el mes y año de una fecha dada.
 * @param {Date} date: objeto fecha a calcular.
 * @param {Object} i18n: modelo que contiene los textos de la aplicación.
 * @returns {string}: mes y año de la fecha en formato FullMonth - YYYY.
 */
utils.getCurrentMonth = function (date, i18n) {
	return i18n.getText("lblMonthLong" + (date.getMonth() + 1)) + " " + date.getFullYear();
};
/**
 * Función que obtiene la diferencia en milisegundos con el horario GMT para enviarlo al servidor
 * @param {Date} date: fecha sobre la que obtener la diferencia.
 * @returns {int}: milisegundos de diferencia.
 */
utils.getOffset = function (date) {

	var time = date.getTime(date),
		offset = date.getTimezoneOffset() * 60 * 1000;

	return time - offset;
};
/**
 * Función que obtiene la diferencia en milisegundos con el horario UTC recibido desde el servidor para sumarlo a la fecha 
 * @param {int} time: milisegundos sobre los que obtener la diferencia.
 * @returns {int}: milisegundos de diferencia.
 */
utils.reverseOffset = function (time) {

	var date = new Date(time),
		offset = date.getTimezoneOffset() * 60 * 1000;

	return time + offset;
};
/**
 * Función que toma una cantidad de segundos y la devuelve en horas y minutos.
 * @param {integer} seconds: número de segundos a calcular.
 * @param {Object} i18n: modelo que contiene los textos de la aplicación.
 * @returns {string}: tiempo en formato X horas Y segundos.
 */
utils.secondsToHoursAndMinutes = function (seconds, i18n) {

	var restHours = Math.floor(seconds / 60 / 60),
		/*
			INI - @jgalaber - 18/11/2020 - Quitar el redondeo de minutos a mostrar.
			··· Codigo Antiguo ···
			restMinutes = Math.round(seconds / 60 % 60),
			··· Codigo Antiguo ···
		*/
		restMinutes = Math.floor(seconds / 60 % 60),
		/* FIN - @jgalaber - 18/11/2020 - Quitar el redondeo de minutos a mostrar. */
		hourText = "h",
		minuteText = "m";

	if (i18n) {
		if (restHours === 1) {
			hourText = i18n.getText("lblHour");
		} else {
			hourText = i18n.getText("lblHours");
		}

		if (restMinutes === 1) {
			minuteText = i18n.getText("lblMinute");
		} else {
			minuteText = i18n.getText("lblMinutes");
		}
	}

	return restHours + " " + hourText + " " + restMinutes + " " + minuteText;
};
/**
 * Función que recibe un Timestamp y devuelve la hora en el formato deseado.
 * @param {Date} date: fecha sobre la que se extrae la hora
 * @returns {string}: hora en formato hh:mm
 */
utils.getTimeFormat = function (date) {
	return date.split("T")[1].substr(0, 5);
};
/**
 * Comprueba si, al pulsar el botón de parar jornada, se ha superado la hora de fin planificada de la jornada.
 * @param {string} schedule: rango de horas de la jornada actual.
 * @returns {boolean}: devuelve true si se ha superado la hora, false en caso contrario.
 */
utils.afterPlannedSchedule = function (schedule) {
	try {
		var deadline = schedule.split(" ")[3].substr(0, 5).split(":"),
			deadlineHours = parseFloat(deadline[0]),
			deadlineMinutes = parseFloat(deadline[1]),
			today = new Date(),
			todayTime = today.getTime(),
			deadlineTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), deadlineHours, deadlineMinutes, 0).getTime();

		return deadlineTime >= todayTime;
	} catch (e) {
		//console.error(e);
	}
};
/** 
 * Función que muestra un mensaje de error.
 * @param {string} msg: mensaje a mostrar.
 */
utils.showErrorMessage = function (msg, _duration) {
	var duration = 3500;
	if (typeof _duration !== 'undefined') {
		duration = _duration;
	}

	sap.ui.require(["sap/m/MessageToast"], function (MessageToast) {
		MessageToast.show(msg, {
			width: "300px",
			animationTimingFunction: "ease-out",
			duration: duration,
			animationDuration: 1500
		});
	});
};
/**
 * Función que recibe y carga la parametrización desde la base de datos.
 * @param {Object} params: array de parámetros a cargar.
 * @param {Object} that: referencia a la vista.
 */
utils.prepareGlobalParameters = function (params, that, JSONModel, callback) {

	// sap.ui.require(["sap/ui/model/json/JSONModel"], function (_JSONModel) {
	var oData = [],
		oDataParametersModel,
		parameter,
		i;

	for (i = 0; i < params.length; i++) {
		parameter = {};
		parameter.pkey = params[i].pkey;
		if (params[i].value !== "" && params[i].value !== null) {
			parameter.value = params[i].value;
		} else {
			parameter.value = params[i].defaultvalue;
		}
		parameter.defaultvalue = params[i].defaultvalue;
		parameter.description = params[i].description;
		parameter.visible = params[i].visible === 1;
		parameter.editable = params[i].editable === 1;
		oData.push(parameter);
	}

	oDataParametersModel = new JSONModel(oData);
	that.getOwnerComponent().setModel(oDataParametersModel, "companyParameters");

	// });

	if (callback) {
		callback();
	}
};
/**
 * Función que carga los parámetros correspondientes a una vista concreta.
 * @param {Object} oModelData: datos del modelo a los que añadir los parámetros.
 * @param {Object} that: vista desde la que se llama la función.
 */
utils.loadParameters = function (oModelData, that) {
	var oModelParametersData = that.getOwnerComponent().getModel("companyParameters").getData(),
		parameter,
		id = that.getView().getId().split("---")[1].substr(0, 3).toUpperCase(),
		i;

	oModelData.parameters = {};

	for (i = 0; i < oModelParametersData.length; i++) {
		//if (oModelParametersData[i].pkey.startsWith(id) || oModelParametersData[i].pkey.startsWith("GEN") || oModelParametersData[i].pkey.startsWith(
		// 		"ROL")) {
		oModelData.parameters[oModelParametersData[i].pkey] = {};
		parameter = {};
		parameter.value = oModelParametersData[i].value;
		parameter.defaultvalue = oModelParametersData[i].defaultvalue;
		parameter.description = oModelParametersData[i].description;
		parameter.visible = oModelParametersData[i].visible;
		parameter.editable = oModelParametersData[i].editable;
		oModelData.parameters[oModelParametersData[i].pkey] = parameter;
		// }

	}
};
/**
 * Función que carga los parámetros de estilo correspondientes a una vista concreta y agrega los estilos correspondientes.
 * @param {Object} oModelData: datos del modelo a los que añadir los parámetros.
 * @param {Object} that: vista desde la que se llama la función.
 */
utils.loadStyle = function (oModelData, that) {
	var oModelParametersData = that.getOwnerComponent().getModel("companyParameters").getData(),
		elements,
		newStyleElement,
		i;

	for (i = 0; i < oModelParametersData.length; i++) {

		if (oModelParametersData[i].pkey.startsWith("COL")) {

			elements = null;
			switch (oModelParametersData[i].pkey) {
			case "COL-Background": //Color de fondo de pantalla
				elements = $(".sapUiGlobalBackgroundImage");
				elements.append('<style type="text/css"></style>');
				newStyleElement = elements.children(':last');
				if (oModelParametersData[i].value.indexOf("linear-gradient") === -1) {
					newStyleElement.html('.sapUiGlobalBackgroundImage{background-image:none;background-color:' + oModelParametersData[i].value + ';}');
				} else {
					newStyleElement.html('.sapUiGlobalBackgroundImage{background-image:' + oModelParametersData[i].value + ';background-color:none;}');
				}
				break;
			case "COL-ContentBox": //Color de fondo del contenedor principal
				elements = $(".contentBox");
				elements.append('<style type="text/css"></style>');
				newStyleElement = elements.children(':last');
				if (oModelParametersData[i].value.indexOf("linear-gradient") === -1) {
					newStyleElement.html('.contentBox{background-image:none;background-color:' + oModelParametersData[i].value + ';}');
				} else {
					newStyleElement.html('.contentBox{background-image:' + oModelParametersData[i].value + ';background-color:none;}');
				}
				break;
			case "COL-IconsPrimary": //Color de los iconos y botones icono principales, de los bordes de los botones y de las imagenes
				elements = $(".sapThemeBrand-asColor:not(.workStateBtn)");
				elements.append('<style type="text/css"></style>');
				newStyleElement = elements.children(':last');
				// Actualización de selector para #TLFNCA
				newStyleElement.html(
					'.sapThemeBrand-asColor:not(.workStateBtn),.sapThemeBrand-asColor:not(.workStateBtn) .sapMBtnInner,.sapThemeBrand-asColor:not(.workStateBtn) .sapMBtnIcon,' +
					'.sapThemeBrand-asColor:not(.workStateBtn) .sapUiIcon,:not(.sapMBtnDisabled) .sapMBtnTransparent>.sapMBtnIcon{color:' +
					oModelParametersData[i].value + '!important;border-color:' + oModelParametersData[i].value + '!important;}');
				/* +
									'.sapUiLocalBusyIndicatorAnimation>div::before,.sapUiLocalBusyIndicatorAnimation>div::after{background:' +
									oModelParametersData[i].value + '!important;')*/
				break;
			case "COL-IconsSecondary": //Color de los iconos secundarios
				elements = $(".sapUiIcon");
				elements.append('<style type="text/css"></style>');
				newStyleElement = elements.children(':last');
				newStyleElement.html('.sapUiIcon.userEditIcon{color:' + oModelParametersData[i].value + '!important;}');
				break;
			case "COL-Texts": //Color de los textos
				elements = $(".sapThemeText");
				elements.append('<style type="text/css"></style>');
				newStyleElement = elements.children(':last');
				newStyleElement.html(
					'.sapThemeText{color:' + oModelParametersData[i].value + '!important;}');
				// Añadido .mainClockText como clase
				break;
			case "COL-WorkStateButton": //Color del botón de fichaje - Específico de #TLFNCA
				elements = $(".workStateBtn.sapThemeBrand-asColor");
				elements.append('<style type="text/css"></style>');
				newStyleElement = elements.children(':last');
				newStyleElement.html(
					'.workStateBtn.sapThemeBrand-asColor{color:' + oModelParametersData[i].value + '!important;}');
				break;
			}
		}
	}
};
/**
 * Función para preparar los textos personalizados de la base de datos, obtiene el modelo.
 * @param {Object} params Objeto con los parámetros obtenidos de base de datos.
 * @param {Object} that Contexto de la aplicación en el momento de llamar a la función.
 * @param {Object} JSONModel Objeto de tipo JSONModel, para generar el modelo.
 */
utils.prepareCustomText = function (params, that, JSONModel) {
	var oData = [],
		oDataParametersModel,
		parameter,
		i;

	for (i = 0; i < params.length; i++) {
		parameter = {};
		parameter.idtext = params[i].idtext;
		parameter.value = params[i].value;
		oData.push(parameter);
	}

	oDataParametersModel = new JSONModel(oData);
	that.getOwnerComponent().setModel(oDataParametersModel, "customText");
};
/**
 * Función para aplicar los textos personalizados a vista concreta.
 * @param {Object} oModelData Modelo con los datos que hay que aplicar.
 * @param {Object} that Contexto en el que está la vista a la que hay que aplicar los textos
 */
utils.loadCustomText = function (oModelData, that) {
	var oModelParametersData = that.getOwnerComponent().getModel("customText").getData(),
		parameter,
		i;
	oModelData.customText = {};

	for (i = 0; i < oModelParametersData.length; i++) {
		oModelData.customText[oModelParametersData[i].idtext] = {};
		parameter = {};
		parameter.value = oModelParametersData[i].value;
		oModelData.customText[oModelParametersData[i].idtext] = parameter;
	}
};
/**
 * Popup de política de flexibilidad horaria, llamado cuando se ficha o se edita un registro
 * y las horas trabajadas superan las horas planificadas.
 * @param {Object} that Contexto dónde se abrirá el popup.
 * @param {Object} i18n Objeto con los textos.
 * @param {Object} text Objeto que contiene el componente sap.m.text que se mostrará en el popup.
 * @param {Object} input Objeto con el componente sap.m.input que se mostrará en el popup.
 * @param {Object} successBtn Objeto que contiene el componente boton con las acciones a realizar cuando se acepte.
 * @param {Object} exitBtn Objeto que contiene el componente boton con las acciones a realizar cuando se cancele.
 * @param {Object} callback En caso de estar, contiene lo que hay que realizar cuando se termine el flujo del popup.
 */
utils.popUpPolicy = function (that, i18n, text, input, successBtn, exitBtn, callback) {
	that.dialog = new sap.m.Dialog("extraHoursDialog", {

		title: i18n.getText("ttlEffectiveWorkTime"),
		type: 'Message',

		content: [text, input],

		endButton: successBtn,
		beginButton: exitBtn,

		afterClose: function () {
			that.dialog.destroy();
		}

	});
	successBtn.addStyleClass("primaryBtn dialogBtn");
	exitBtn.addStyleClass("secondaryBtn dialogBtn");
	that.dialog.open();
};
/**
 * Popup para aceptar política de seguridad al iniciar sesión si no ha sido aceptada anteriormente.
 * @param {Object} that Contexto dónde se abrirá el popup.
 * @param {Object} i18n Objeto con los textos.
 * @param {Object} text Objeto que contiene el componente sap.m.text que se mostrará en el popup.
 * @param {Object} successBtn Objeto que contiene el componente boton con las acciones a realizar cuando se acepte.
 */
utils.popUpSecurityPolicy = function (that, i18n, text, checkbox, successBtn) {
	successBtn.addStyleClass("primaryBtn dialogBtn");

	var myText = text;
	myText.addEventDelegate({
		onAfterRendering: function () {
			text.focus();
		}
	});

	var myCheck = checkbox;
	// myCheck.blur();

	that.dialog = new sap.m.Dialog("securityPolicyDialog", {
		title: i18n.getText("ttlSecurityPolicy"),
		type: 'Message',

		content: [myText, myCheck],

		beginButton: successBtn,

		afterClose: function () {
			that.dialog.destroy();
		}
	});

	/* Se añade control para deshabilitar el teclado durante el tiempo que esté el popup mostrado para 
	evitar que cierren el popup sin haber aceptado pulsando Esc*/
	that.dialog.attachBrowserEvent("keydown", function (oEvent) {
		oEvent.stopPropagation();
		oEvent.preventDefault();
	});

	that.dialog.open();
	if (checkbox.getSelected() === false) {
		successBtn.setEnabled(false);
	}
	// document.getElementById("securityPolicyDialog-cont").scrollTop = 0;
	var controlScroll = true;
	document.getElementById("securityPolicyDialog-cont").onscroll = function (elem) {
		if (elem.target.offsetHeight + elem.target.scrollTop >= elem.target.scrollHeight) {
			if (controlScroll) {
				document.getElementById("securityPolicyDialog-cont").scrollTop = 0;
				controlScroll = false;
			}
		}
	};
};
/**
 * Cambia el formato de fecha de dd/mm/yyyy a yyyy/mm/dd
 */
utils.voltearFecha = function (fecha) {

	var resDate = '';
	var separator = '-';

	try {
		if (fecha.indexOf('/') !== -1) {
			separator = '/';
		}

		var arrFecha = fecha.split(separator);

		if (arrFecha[0].length === 4) {
			resDate = arrFecha[0] + '/' + arrFecha[1] + '/' + arrFecha[2];
		} else if (arrFecha[2].length === 4 && arrFecha[0].length === 2) {
			resDate = arrFecha[2] + '/' + arrFecha[1] + '/' + arrFecha[0];
		} else {
			resDate = fecha;
		}
	} catch (e) {
		resDate = fecha;
	}
	return resDate;
};

utils.verifyDateRange = function (date1, date2, i18n) {
	var range = (date2 - date1) / 1000 / 60 / 60 / 24;

	if (range < 0) {
		return {
			error: true,
			error_info: i18n.getText("txtPrimeraFechaDebeSerSuperiorASegunda")
		};
	} else if (range >= 0 && range > 366) {
		return {
			error: true,
			error_info: i18n.getText("txtFechaIndicadaSuperaAnio")
		};
	} else if (range >= 0 && range <= 366) {
		return {
			error: false
		};
	}
};

utils.clockFormat = function (hours) {
	var result = "",
		timeLeft = parseInt((hours - parseInt(hours)) * 60);

	result += parseInt(hours) < 10 ? "0" + parseInt(hours) : parseInt(hours);
	result += ":";
	result += timeLeft < 10 ? "0" + timeLeft : timeLeft;

	return result;
}

utils.prepareRecordModel = function (oRecordModelData) {

	var oNewRecordModelData = {
		totalworkingtime: oRecordModelData.hasOwnProperty("totalworkingtime") ? oRecordModelData.totalworkingtime : 0,
		totalrestingtime: oRecordModelData.hasOwnProperty("totalrestingtime") ? oRecordModelData.totalrestingtime : 0,
		checkgoodpractices: oRecordModelData.hasOwnProperty("checkgoodpractices") ? oRecordModelData.checkgoodpractices : null,
		checkextrahours: oRecordModelData.hasOwnProperty("checkextrahours") ? oRecordModelData.checkextrahours : null,
		idresttype: oRecordModelData.hasOwnProperty("idresttype") ? oRecordModelData.idresttype : null,
		idemployee: oRecordModelData.idemployee,
		startdate: oRecordModelData.startdate,
		idcompany: oRecordModelData.idcompany,
		idoffice: oRecordModelData.idoffice,
		recordinitdate: oRecordModelData.recordinitdate,
		idstatus: oRecordModelData.idstatus,
		recordinittime: oRecordModelData.recordinittime,
		recordenddate: oRecordModelData.recordenddate,
		recordendtime: oRecordModelData.recordendtime,
		editinittime: oRecordModelData.editinittime,
		editendtime: oRecordModelData.editendtime,
		editrestingtime: oRecordModelData.editrestingtime,
		invalidRecord: oRecordModelData.invalidRecord,
		idregtype: oRecordModelData.idregtype,
		offset: oRecordModelData.offset,
	};

	if (oRecordModelData.hasOwnProperty("restdetail")) {
		oNewRecordModelData.restdetail = oRecordModelData.restdetail;
	}
	if (oRecordModelData.hasOwnProperty("inittimestring")) {
		oNewRecordModelData.inittimestring = oRecordModelData.inittimestring;
	}
	if (oRecordModelData.hasOwnProperty("state")) {
		oNewRecordModelData.state = oRecordModelData.state;
	}
	if (oRecordModelData.hasOwnProperty("extraHours")) {
		oNewRecordModelData.extraHours = oRecordModelData.extraHours;
	}
	if (oRecordModelData.hasOwnProperty("editing")) {
		oNewRecordModelData.editing = oRecordModelData.editing;
	}
	if (oRecordModelData.hasOwnProperty("editingToday")) {
		oNewRecordModelData.editingToday = oRecordModelData.editingToday;
	}

	return oNewRecordModelData;

};

utils.formatToDailyRecords = function (initDateMoment) {
	
	/*INI - 24/11/2020 - Correcciones Detectadas - @jgalaber - Corrección formateo de fecha 
	 - La fecha se estaba formateando quitando un mes, por ejemplo si la fecha actual es el 24/11/2020 devolvia 24/10/2020.
	*/
	/*
	··· Codigo Antiguo ···
	
	var formatInitMoment = "";
	formatInitMoment += initDateMoment.getDate() < 10 ? "0" + initDateMoment.getDate() : initDateMoment.getDate();
	formatInitMoment += "/";
	formatInitMoment += initDateMoment.getMonth() < 10 ? "0" + (initDateMoment.getMonth() + 1) : initDateMoment.getMonth();
	formatInitMoment += "/";
	formatInitMoment += initDateMoment.getFullYear() + " ";

	formatInitMoment += initDateMoment.getHours() < 10 ? "0" + initDateMoment.getHours() : initDateMoment.getHours();
	formatInitMoment += ":";
	formatInitMoment += initDateMoment.getMinutes() < 10 ? "0" + initDateMoment.getMinutes() : initDateMoment.getMinutes();
	formatInitMoment += ":";
	formatInitMoment += initDateMoment.getSeconds() < 10 ? "0" + initDateMoment.getSeconds() : initDateMoment.getSeconds();

	return formatInitMoment;
	
	······················
	*/
	
	/*FIN - - 24/11/2020 - Correcciones Detectadas - @jgalaber - Corrección formateo de fecha */
	var formatedDate =  ('00' + initDateMoment.getDate() ).slice(-2)	+ "/" + ('00' + (initDateMoment.getMonth() + 1) ).slice(-2) + "/" + ( '0000' + initDateMoment.getFullYear() ).slice(-4),
		formatedTime = ( '00'   + initDateMoment.getHours() ).slice(-2) + ":" + ('00' + initDateMoment.getMinutes() ).slice(-2)	    + ":" + ('00' + initDateMoment.getSeconds() ).slice(-2);

	return formatedDate + ' ' + formatedTime;
};

/**
 *  @jgalaber - 25/08/2020
 *	- Funcion que devuelve del modelo 'status' su valor por la id
 * 
 *	--- JSDOC ---
 *	@param	{Integer}	id 		Identificador del status (key)
 *	@return {String}	result	String que contiene el valor del estado (value)
 */
utils.getStatusById = function (id, status) {

	var result = status.getData().Status.filter(function (elem) {
		return elem.key == id
	});

	return result.length > 0 ? result[0].value : "";

};

/**
 *  @jgalaber - 05/10/2020
 *  - Función que obtiene el parámetro buscado de los parámetros 'GETS'
 * 
 *  --- JSDOC ---
 *	@param	{String}	parameterName 		Nombre del parámetro buscado
 *	@return {String}	result				Valor del parámetro buscado
 */
utils.findGetParameter = function (parameterName) {
	var result = null,
		tmp = [];
	location.search
		.substr(1)
		.split("&")
		.forEach(function (item) {
			tmp = item.split("=");
			if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
		});
	return result;
};

utils.getTimeFromDate = function ( date ) {
	var dateStr = date.toISOString()
	return dateStr.substring( (dateStr.indexOf('T') + 1), dateStr.indexOf('.') );	
};

/**
 *  @jgalaber - 20/11/2020 
 *  - Metodo que obtiene los datos de una fecha con cualquier GTM y lo pasa a GTM 00.
 *  @param {Date} date Objeto Fecha
 *  @return {Date} Objeto fecha con GTM a 00
 */
utils.setDateToGTM00 = function (date) {
	
	return new Date( ('0000' + date.getFullYear()).slice(-4) + '-' + ('00' + (date.getMonth()+1)).slice(-2) + '-' + ('00' + date.getDate()).slice(-2) + 'T' + ('00' + date.getHours()).slice(-2) + ':' + ('00' + date.getMinutes()).slice(-2) + ':' + ('00' + date.getSeconds()).slice(-2) + '.000Z');
	
};

utils.generatePopupInvalidCredentials = function () {
	
	var popup = new sap.m.Dialog({
		title: "Invalid Credentials",
		showHeader: false,
		id: "invalidCredentials",
		content: new sap.m.VBox({
			alignItems: sap.m.FlexAlignItems.Center,
			items: [
				new sap.m.HBox({
					alignItems: sap.m.FlexAlignItems.Center,
					justifyContent: sap.m.FlexJustifyContent.SpaceBetween,
					items: [
						new sap.m.Label({
							text: "Credenciales inválidas, serás redireccionado a SuccessFactors"
						})
					]
				})
			]
		})
	});

	return popup;
};

utils.destroyPopupWithTimeoutAndRedirectToSFSF = function (popup, timeout) {
	popup.open();
	setTimeout(function () {
		popup.close();
		popup.destroy();
		var thisLocation = window.location.hostname,
		QAUrl = constants.SFSF.QuaURL,
		DevURL = constants.SFSF.DevURL;

	if (thisLocation.indexOf("telefonicafichajes-s2c88f45f") !== -1) {
		window.location.replace("https://" + DevURL + "/sf/start", "_self");
	} else if (thisLocation.indexOf("telefonicafichajes-g399b72atz") !== -1) {
		window.location.replace("https://hcm12preview.sapsf.eu/sf/liveprofile", "_self");
	} else if (thisLocation.indexOf("telefonicafichajes-f7dl6r99zq") !== -1) {
		window.location.replace("https://performancemanager5.successfactors.eu/sf/liveprofile", "_self");
	} else {
		window.location.replace("https://" + DevURL + "/sf/start", +"_self");
	}
	}, timeout);

};

// ibarraza
utils.treatDailyRecordsWithPausesFromDB =  function (data, i18n) {
	var recordinitdate,
		datetimemomentDate,
		datetimemomentTime;

	data.forEach(elem => {
		recordinitdate	    = (elem.recordinitdate.substr(0, 10)).split("-");
		datetimemomentDate  = utils.stringifyDate(new Date(elem.datetimemoment), 1);
		datetimemomentTime  = elem.datetimemoment.split("T")[1].substr(0, 8);
		elem.datetimemoment = datetimemomentDate + " " + datetimemomentTime; //Fecha formato DD/MM/YYYY HH:mm
		elem.recordinitdate = `${recordinitdate[2]}/${recordinitdate[1]}/${recordinitdate[0]}`; //Fecha en formato DD/MM/YYYY
		// Tipo de Registro
		switch (elem.idregtype) {
		case constants.regType.auto:
			elem.idregtype = i18n.getText("regAuto");
			break;
		case constants.regType.manual:
			elem.idregtype = i18n.getText("regManual");
			break;
		case constants.regType.edited:
			elem.idregtype = i18n.getText("regEdited");
			break;
		}
		// Estado del Registro
		switch (elem.idstatus) {
		case constants.workDayState.working:
			elem.idstatusdetail = i18n.getText("sttWork");
			break;
		case constants.workDayState.resting:
			elem.idstatusdetail = i18n.getText("sttRest");
			break;
		case constants.workDayState.afterWorkDay:
			elem.idstatusdetail = i18n.getText("sttEnd");
			break;
		case constants.workDayState.afterResting:
			elem.idstatusdetail = i18n.getText("sttBeforeWork");
			break;
		}
	});
};

utils.getDateWithOffset = function(timestamp){
	return new Date(new Date(timestamp).getTime() + new Date(timestamp).getTimezoneOffset() * 60 * 1000);
};

utils.getDateFromTimestamp = function(timestamp){
	return timestamp.split('T')[0];	
};

utils.formatTimeToHoursString = function(time){
	var minutes = Math.floor(time / 60);
		minutes = (minutes < 10) ? '0' + minutes: minutes;
	var	seconds = (time % 60);
		seconds = (seconds < 10) ? '0' + seconds :  seconds;
		
	return minutes + ':' + seconds;
};

utils.formatapprovalstatus = function(status, i18n) {
	var statusText = "";
	switch(status){
		case 1: statusText =  i18n.getText("lblPending"); break; 
		case 2: statusText =  i18n.getText("lblAproved"); break; 
		case 3: statusText =  i18n.getText("lblRejected"); break; 
		default: statusText = i18n.getText("lblNothing"); break; 
	}
	return statusText;
};

utils.prepareDateLimit =  function(date){
	var temp = new Date(utils.voltearFecha(date + + "00:00:00"));
	return new Date(temp.setDate(temp.getDate() + 1));
};