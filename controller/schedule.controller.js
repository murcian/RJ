sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History",
	"sap/ui/Device",
	"sap/ui/model/json/JSONModel"
], function (Controller, History, Device, JSONModel) {
	"use strict";

	return Controller.extend("epicfichajes.epicfichajes.controller.Calendario", {
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf epicfichajes.epicfichajes.view.schedule
		 */
		onInit: function () {

			this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			this.oRouter.getRoute("schedule").attachPatternMatched(this.loadData, this);
			Device.resize.attachHandler(this.sizeChanged, this);

		},
		/**
		 * Comprueba la conexión y llama a la función que carga los datos de la vista.
		 */
		loadData: function () {

			var that = this,
				oView = this.getView(),
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				urlCustomText = constants.api.urlGetCustomText;

			oView.setBusyIndicatorDelay(0);
			oView.setBusy(true);

			dbutils.checkConnection(this.oRouter, i18n, this.getView().getId(), that, function () {
				try {
					that.i18n = that.getOwnerComponent().getModel("i18n").getResourceBundle();
					that.oModel = new JSONModel("./model/schedule.json");
					that.oModel.attachRequestCompleted(function () {
						utils.loadParameters(that.oModel.getData(), that);

						var postDataCT = {
							idcompany: sap.ui.getCore().getModel("userSessions").getData().idcompany,
							idoffice: sap.ui.getCore().getModel("userSessions").getData().idoffice,
							language: sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2)
						};

						dbutils.DBPost(urlCustomText, postDataCT, i18n, function (parameters) {
							//Guardar parameters en un modelo
							utils.prepareCustomText(parameters, that, JSONModel);
							utils.loadCustomText(that.oModel.getData(), that);
						});

						that.loadView();
					});
				} catch (e) {
					that.oRouter.navTo("home");
				}
			});

		},
		/** 
		 * Función que aplica estilos al calendario semanal, acorde a los datos cargados previamente. 
		 */
		paintWeeklySchedule: function () {

			var i,
				tableWeekCells = this.getView().byId("scheduleWeekDaysTable").getItems()[0].getCells(),
				oDataWeekStyle = this.oModel.getData().dataWeekStyle,
				dayName;

			for (i = 0; i < 7; i++) {
				dayName = constants.initialDays[i];
				tableWeekCells[i].removeStyleClass("currentDay nonWorkingDay otherMonthDay vacationDay festiveDay");
				if (oDataWeekStyle.week0["style" + dayName] !== "") {
					tableWeekCells[i].addStyleClass(oDataWeekStyle.week0["style" + dayName]);
				}
			}

		},
		/** 
		 * Función que obtiene los datos del calendario para la semana en curso.
		 */
		getWeeklySchedule: function () {

			var that = this,
				postData = sap.ui.getCore().getModel("userSessions").getData(),
				today = new Date(),
				firstDayOfWeek = utils.getFirstDayOfWeek(today),
				lastDayOfWeek = utils.getLastDayOfWeek(today),
				urlSCPProcedureAbsences = constants.api.urlGetHolidays,
				urlSCPProcedureCalendars = constants.api.urlGetCalendars,
				urlSCPProcedureSchedule = constants.api.urlGetWorkScheduleEmployeeByDate,
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				lng = sap.ui.getCore().getConfiguration().getLanguage();

			if (lng.length > 2) {
				lng = lng.split("-")[0].toUpperCase();
			}

			postData.initdate = utils.stringifyDate(firstDayOfWeek, 2);
			postData.enddate = utils.stringifyDate(lastDayOfWeek, 2);
			postData.lng = lng.toUpperCase();

			dbutils.DBPost(urlSCPProcedureAbsences, postData, i18n, function (absences) {
				dbutils.DBPost(urlSCPProcedureCalendars, postData, i18n, function (holidays) {
					dbutils.DBPost(urlSCPProcedureSchedule, postData, i18n, function (data) {
						that.loadWeeklySchedule(data, holidays, absences);
					});
				});
			});

		},
		/**
		 * Función que recibe los datos de calendario y vacaciones del servidor y los carga en la tabla
		 * del calendario semanal y prepara los estilos para ser pintados.
		 * @param {array} data: datos del calendario.
		 * @param {array} holidays: días festivos (si los hubiese).
		 * @param {array} absences: días de vacaciones del usuario (si los tuviese).
		 */
		loadWeeklySchedule: function (data, holidays, absences) {

			var i,
				that = this,
				weeklyEstimate = 0,
				oDataLayout = this.oModel.getData().dataLayout,
				oDataWeek = this.oModel.getData().dataWeekTable,
				oModelWeek,
				oDataWeekStyle = this.oModel.getData().dataWeekStyle,
				date = new Date(),
				record,
				firstDayOfWeek = utils.getFirstDayOfWeek(date),
				initialMonth = date.getMonth(),
				initialDay = date.getDate(),
				currYear,
				currMonth,
				currDay,
				formattedDate,
				dayName,
				initTime,
				endTime,
				checkHolidays = true,
				holiday = false,
				checkAbsences = true,
				absence = false;

			if (holidays.length === 0) {
				checkHolidays = false;
			}
			if (absences.length === 0) {
				checkAbsences = false;
			}

			for (i = 0; i < 7; i++) {
				currYear = firstDayOfWeek.getFullYear();
				currMonth = firstDayOfWeek.getMonth();
				currDay = firstDayOfWeek.getDate();
				dayName = constants.initialDays[i];
				oDataWeek.weeks.week0["day" + dayName] = currDay;
				formattedDate = new Date(utils.stringifyDate(firstDayOfWeek, 2));
				holiday = false;
				absence = false;

				if (checkHolidays) {
					if (utils.stringifyDate(formattedDate, 2) === holidays[0].datecal.split("T")[0]) {
						holidays.splice(0, 1);
						if (holidays.length === 0) {
							checkHolidays = false;
						}
						holiday = true;
					}
				}
				/*ini LZ 15/01/2020 Modificada la lógica de mostrado de las vacaciones*/

				// if (checkAbsences) {
				// 	if (utils.stringifyDate(formattedDate, 2) === absences[0].initdate.split("T")[0]) {
				// 		absences.splice(0, 1);
				// 		if (absences.length === 0) {
				// 			checkAbsences = false;
				// 		}
				// 		absence = true;
				// 	}
				// }

				if (checkAbsences) {
					var fromDate = new Date(absences[0].initdate),
						toDate = new Date(absences[0].enddate),
						today = formattedDate;
					if (today.getTime() <= toDate.getTime() && today.getTime() >= fromDate.getTime()) {
						if (today.getTime() === toDate.getTime()) {
							absences.splice(0, 1);
						}
						if (absences.length === 0) {
							checkAbsences = false;
						}
						absence = true;
					}
				}
				/*fin LZ 15/01/2020 Modificada la lógica de mostrado de las vacaciones*/

				record = jQuery.grep(data, function (obj) {
					return (parseFloat(obj.numday) === i + 1 && new Date(obj.ws_initdate) <= formattedDate && new Date(obj.ws_enddate) >=
						formattedDate);
				});

				if (record.length !== 0) {
					if (holiday) {
						oDataWeek.weeks.week0["workDayText" + dayName] = "";
						oDataWeek.weeks.week0["hourEntry" + dayName] = this.i18n.getText("lblDay");
						oDataWeek.weeks.week0["hourExit" + dayName] = this.i18n.getText("lblHoliday");
						oDataWeek.weeks.week0["hourEstimate" + dayName] = "";
						oDataWeekStyle.week0["style" + dayName] += " festiveDay";
					} else if (absence) {
						oDataWeek.weeks.week0["workDayText" + dayName] = "";
						oDataWeek.weeks.week0["hourEntry" + dayName] = this.i18n.getText("lblDay");
						oDataWeek.weeks.week0["hourExit" + dayName] = this.i18n.getText("lblAbsence");
						oDataWeek.weeks.week0["hourEstimate" + dayName] = "";
						oDataWeekStyle.week0["style" + dayName] += " vacationDay";
					} else {
						oDataWeek.weeks.week0["workDayText" + dayName] = record[0].plannedhours === "0" ? "" : " - ";
						if (oDataWeek.weeks.week0["workDayText" + dayName] === " - ") {
							initTime = utils.getTimeFormat(record[0].wsdm_inittime);
							endTime = utils.getTimeFormat(record[0].wsdm_endtime);
							oDataWeek.weeks.week0["hourEntry" + dayName] = initTime;
							oDataWeek.weeks.week0["hourExit" + dayName] = endTime;
							weeklyEstimate += parseFloat(record[0].plannedhours);
							if (window.innerWidth > 1028) {
								if (record[0].plannedhours === 1) {
									oDataWeek.weeks.week0["hourEstimate" + dayName] = record[0].plannedhours + " " + this.i18n.getText("lblHour");
								} else {
									oDataWeek.weeks.week0["hourEstimate" + dayName] = record[0].plannedhours + " " + this.i18n.getText("lblHours");
								}
							} else {
								oDataWeek.weeks.week0["hourEstimate" + dayName] = record[0].plannedhours + " " + this.i18n.getText("lblH");
							}
						} else {
							oDataWeek.weeks.week0["hourEntry" + dayName] = this.i18n.getText("lblDay");
							oDataWeek.weeks.week0["hourExit" + dayName] = this.i18n.getText("lblFree");
							oDataWeek.weeks.week0["hourEstimate" + dayName] = "";
							oDataWeekStyle.week0["style" + dayName] += " nonWorkingDay";
						}
					}
				} else {
					oDataWeek.weeks.week0["workDayText" + dayName] = "";
					oDataWeek.weeks.week0["hourEntry" + dayName] = this.i18n.getText("actNo");
					oDataWeek.weeks.week0["hourExit" + dayName] = this.i18n.getText("lblPlanned");
					oDataWeek.weeks.week0["hourEstimate" + dayName] = "";
				}

				if (initialDay === currDay) {
					oDataWeekStyle.week0["style" + dayName] += " currentDay";
				}
				if (initialMonth !== currMonth) {
					oDataWeekStyle.week0["style" + dayName] += " otherMonthDay";
				}

				firstDayOfWeek = new Date(currYear, currMonth, (currDay + 1), 12, 0, 0);
			}

			oDataLayout.weeklyEstimate = weeklyEstimate;
			this.getView().byId("contentBox").getModel().updateBindings();
			utils.loadParameters(oDataWeek, that);
			oModelWeek = new JSONModel(oDataWeek);
			this.getView().byId("scheduleWeekDaysTable").setModel(oModelWeek);
			this.paintWeeklySchedule();

		},
		/** 
		 * Función que aplica estilos al calendario mensual, acorde a los datos cargados previamente. 
		 */
		paintMonthlySchedule: function () {

			var i, j,
				tableMonthItems = this.getView().byId("scheduleMonthDaysTable").getItems(),
				tableMonthCells,
				oDataMonthStyle = this.oModel.getData().dataMonthStyle,
				dayName;

			for (i = 0; i < 6; i++) {
				tableMonthCells = tableMonthItems[i].getCells();
				for (j = 0; j < 7; j++) {
					dayName = constants.initialDays[j];
					tableMonthCells[j].removeStyleClass("currentDay nonWorkingDay otherMonthDay vacationDay festiveDay");
					if (oDataMonthStyle["week" + i]["style" + dayName] !== "") {
						tableMonthCells[j].addStyleClass(oDataMonthStyle["week" + i]["style" + dayName]);
						oDataMonthStyle["week" + i]["style" + dayName] = "";
					}
				}
			}

		},
		/** 
		 * Función que obtiene los datos del calendario para el mes especificado.
		 * @param {Date} date: fecha perteneciente al mes a obtener.
		 */
		getMonthlySchedule: function (date) {

			var that = this,
				postData = sap.ui.getCore().getModel("userSessions").getData(),
				firstDayOfMonth = utils.getFirstDayOfMonth(date),
				lastDayOfMonth = utils.getLastDayOfMonth(date),
				urlSCPProcedureAbsences = constants.api.urlGetHolidays,
				urlSCPProcedureCalendars = constants.api.urlGetCalendars,
				urlSCPProcedureSchedule = constants.api.urlGetWorkScheduleEmployeeByDate,
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				lng = sap.ui.getCore().getConfiguration().getLanguage();

			if (lng.length > 2) {
				lng = lng.split("-")[0];
			}

			firstDayOfMonth = utils.getFirstDayOfWeek(firstDayOfMonth);
			lastDayOfMonth = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), firstDayOfMonth.getDate() + 41);

			postData.initdate = utils.stringifyDate(firstDayOfMonth, 2);
			postData.enddate = utils.stringifyDate(lastDayOfMonth, 2);
			postData.lng = lng.toUpperCase();

			dbutils.DBPost(urlSCPProcedureAbsences, postData, i18n, function (absences) {
				dbutils.DBPost(urlSCPProcedureCalendars, postData, i18n, function (holidays) {
					dbutils.DBPost(urlSCPProcedureSchedule, postData, i18n, function (data) {
						that.loadMonthlySchedule(data, date, holidays, absences);
					});
				});
			});

		},
		/**
		 * Función que recibe los datos de calendario y vacaciones del servidor y los carga en la tabla
		 * del calendario mensual y prepara los estilos para ser pintados.
		 * @param {array} data: datos del calendario.
		 * @param {Date} date: fecha perteneciente al mes a cargar.
		 * @param {array} holidays: días festivos (si los hubiese).
		 * @param {array} absences: días de vacaciones del usuario (si los tuviese).
		 */
		loadMonthlySchedule: function (data, date, holidays, absences) {

			var i, j,
				that = this,
				monthlyEstimate = 0,
				oDataLayout = this.oModel.getData().dataLayout,
				oDataMonth = this.oModel.getData().dataMonthTable,
				oModelMonth,
				oDataMonthStyle = this.oModel.getData().dataMonthStyle,
				record,
				firstDayOfMonth = utils.getFirstDayOfMonth(date),
				firstDayOfWeek = utils.getFirstDayOfWeek(firstDayOfMonth),
				initialMonth = date.getMonth(),
				todayYear = oDataLayout.todayDate.getFullYear(),
				todayMonth = oDataLayout.todayDate.getMonth(),
				todayDay = oDataLayout.todayDate.getDate(),
				currYear,
				currMonth,
				currDay,
				formattedDate,
				dayName,
				initTime,
				endTime,
				checkHolidays = true,
				checkAbsences = true,
				holiday = false,
				absence = false;

			oDataMonth.weeks.week1.currentMonth = utils.getCurrentMonth(date, this.i18n);
			oDataLayout.currentMonth = oDataMonth.weeks.week1.currentMonth;

			if (holidays.length === 0) {
				checkHolidays = false;
			}
			if (absences.length === 0) {
				checkAbsences = false;
			}

			for (i = 0; i < 6; i++) {
				for (j = 0; j < 7; j++) {
					currYear = firstDayOfWeek.getFullYear();
					currMonth = firstDayOfWeek.getMonth();
					currDay = firstDayOfWeek.getDate();
					dayName = constants.initialDays[j];
					oDataMonth.weeks["week" + i]["day" + dayName] = currDay;
					formattedDate = new Date(utils.stringifyDate(firstDayOfWeek, 2));
					holiday = false;
					absence = false;

					if (checkHolidays) {
						if (utils.stringifyDate(formattedDate, 2) === holidays[0].datecal.split("T")[0]) {
							holidays.splice(0, 1);
							if (holidays.length === 0) {
								checkHolidays = false;
							}
							holiday = true;
						}
					}

					/*ini LZ 15/01/2020 Modificada la lógica de mostrado de las vacaciones*/

					// if (checkAbsences) {
					// 	if (utils.stringifyDate(formattedDate, 2) === absences[0].initdate.split("T")[0]) {
					// 		absences.splice(0, 1);
					// 		if (absences.length === 0) {
					// 			checkAbsences = false;
					// 		}
					// 		absence = true;
					// 	}
					// }

					if (checkAbsences) {
						var fromDate = new Date(absences[0].initdate),
							toDate = new Date(absences[0].enddate),
							today = formattedDate;
						if (today.getTime() <= toDate.getTime() && today.getTime() >= fromDate.getTime()) {
							if (today.getTime() === toDate.getTime()) {
								absences.splice(0, 1);
							}
							if (absences.length === 0) {
								checkAbsences = false;
							}
							absence = true;
						}
					}
					/*fin LZ 15/01/2020 Modificada la lógica de mostrado de las vacaciones*/

					record = jQuery.grep(data, function (obj) {
						return (parseFloat(obj.numday) === j + 1 && new Date(obj.ws_initdate) <= formattedDate && new Date(obj.ws_enddate) >=
							formattedDate);
					});

					if (record.length !== 0) {
						if (holiday) {
							oDataMonth.weeks["week" + i]["workDayText" + dayName] = "";
							oDataMonth.weeks["week" + i]["hourEntry" + dayName] = this.i18n.getText("lblDay");
							oDataMonth.weeks["week" + i]["hourExit" + dayName] = this.i18n.getText("lblHoliday");
							oDataMonth.weeks["week" + i]["hourEstimate" + dayName] = "";
							oDataMonthStyle["week" + i]["style" + dayName] += " festiveDay";
						} else if (absence) {
							oDataMonth.weeks["week" + i]["workDayText" + dayName] = "";
							oDataMonth.weeks["week" + i]["hourEntry" + dayName] = this.i18n.getText("lblDay");
							oDataMonth.weeks["week" + i]["hourExit" + dayName] = this.i18n.getText("lblAbsence");
							oDataMonth.weeks["week" + i]["hourEstimate" + dayName] = "";
							oDataMonthStyle["week" + i]["style" + dayName] += " vacationDay";
						} else {
							oDataMonth.weeks["week" + i]["workDayText" + dayName] = record[0].plannedhours === "0" ? "" : " - ";
							if (oDataMonth.weeks["week" + i]["workDayText" + dayName] === " - ") {
								initTime = utils.getTimeFormat(record[0].wsdm_inittime);
								endTime = utils.getTimeFormat(record[0].wsdm_endtime);
								oDataMonth.weeks["week" + i]["hourEntry" + dayName] = initTime;
								oDataMonth.weeks["week" + i]["hourExit" + dayName] = endTime;
								if (initialMonth === currMonth) {
									monthlyEstimate += parseFloat(record[0].plannedhours);
								}
								if (record[0].plannedhours === 1) {
									oDataMonth.weeks["week" + i]["hourEstimate" + dayName] = record[0].plannedhours + " " + this.i18n.getText("lblHour");
								} else {
									oDataMonth.weeks["week" + i]["hourEstimate" + dayName] = record[0].plannedhours + " " + this.i18n.getText("lblHours");
								}
							} else {
								oDataMonth.weeks["week" + i]["hourEntry" + dayName] = this.i18n.getText("lblDay");
								oDataMonth.weeks["week" + i]["hourExit" + dayName] = this.i18n.getText("lblFree");
								oDataMonth.weeks["week" + i]["hourEstimate" + dayName] = "";
								oDataMonthStyle["week" + i]["style" + dayName] += " nonWorkingDay";
							}
						}
					} else {
						oDataMonth.weeks["week" + i]["workDayText" + dayName] = "";
						oDataMonth.weeks["week" + i]["hourEntry" + dayName] = this.i18n.getText("actNo");
						oDataMonth.weeks["week" + i]["hourExit" + dayName] = this.i18n.getText("lblPlanned");
						oDataMonth.weeks["week" + i]["hourEstimate" + dayName] = "";
					}

					if (todayDay === currDay && todayMonth === currMonth && todayYear === currYear) {
						oDataMonthStyle["week" + i]["style" + dayName] += " currentDay";
					}
					if (initialMonth !== currMonth) {
						oDataMonthStyle["week" + i]["style" + dayName] += " otherMonthDay";
					}

					firstDayOfWeek = new Date(currYear, currMonth, (currDay + 1));
				}
			}

			oDataLayout.monthlyEstimate = monthlyEstimate;
			this.getView().byId("contentBox").getModel().updateBindings();
			utils.loadParameters(oDataMonth, that);
			oModelMonth = new JSONModel(oDataMonth);
			this.getView().byId("scheduleMonthDaysTable").setModel(oModelMonth);
			this.paintMonthlySchedule();

		},
		/**
		 * Carga de los datos de la vista que no pertenecen a las tablas, y llama a las funciones que cargan las tablas.
		 */
		loadView: function () {

			var dataLayout = this.oModel.getData().dataLayout,
				oModelLayout,
				today = new Date(),
				firstDayOfWeek = utils.getFirstDayOfWeek(today),
				lastDayOfWeek = utils.getLastDayOfWeek(today),
				userSession = sap.ui.getCore().getModel("userSessions").getData();

			dataLayout.navDate = today;
			dataLayout.todayDate = today;
			dataLayout.dateInterval = "(" + utils.stringifyDate(firstDayOfWeek, 1) + " - " + utils.stringifyDate(lastDayOfWeek, 1) + ")";
			dataLayout.scheduleDetailsVisible = false;
			dataLayout.freeDaysBtn = this.i18n.getText("lblMarkDays");
			dataLayout.reducedWorkingDay = userSession.reducedworkingday;
			dataLayout.reducedPercentage = this.i18n.getText("lblReducedPercentage", userSession.reducedpercentage);

			this.getWeeklySchedule();
			this.getMonthlySchedule(today);

			oModelLayout = new JSONModel(dataLayout);
			this.getView().byId("contentBox").setModel(oModelLayout);

			this.sizeChanged({
				"height": window.innerHeight,
				"width": window.innerWidth
			});

		},
		/**
		 * Función ejecutada al cambiar el tamaño de la pantalla.
		 * Cambia variables de texto para que queden acorde con el diseño.
		 * @param {array} mParams: altura y anchura actuales de la pantalla.
		 */
		sizeChanged: function (mParams) {

			var oDataWeekTable = this.oModel.getData().dataWeekTable,
				oDataMonthTable = this.oModel.getData().dataMonthTable,
				estimatedHours,
				dayName,
				currValue,
				that = this,
				i;

			if (mParams.width <= 1028) {
				for (i = 0; i < 7; i++) {
					dayName = constants.initialDays[i];
					currValue = oDataWeekTable.weeks.week0["hourEstimate" + dayName];
					oDataWeekTable.days["day" + i] = this.i18n.getText("lblDayWeekShort" + constants.initialDays[i]);
					oDataMonthTable.days["day" + i] = this.i18n.getText("lblDayWeekShort" + constants.initialDays[i]);
					if (currValue !== "") {
						estimatedHours = currValue.split(" ");
						oDataWeekTable.weeks.week0["hourEstimate" + dayName] = estimatedHours[0] + " " + this.i18n.getText("lblH");
					}
				}
			} else {
				for (i = 0; i < 7; i++) {
					dayName = constants.initialDays[i];
					currValue = oDataWeekTable.weeks.week0["hourEstimate" + dayName];
					oDataWeekTable.days["day" + i] = this.i18n.getText("lblDayWeekLong" + constants.initialDays[i]);
					oDataMonthTable.days["day" + i] = this.i18n.getText("lblDayWeekLong" + constants.initialDays[i]);
					if (currValue !== "") {
						estimatedHours = currValue.split(" ");
						if (parseFloat(estimatedHours[0]) === 1) {
							oDataWeekTable.weeks.week0["hourEstimate" + dayName] = estimatedHours[0] + " " + this.i18n.getText("lblHour");
						} else {
							oDataWeekTable.weeks.week0["hourEstimate" + dayName] = estimatedHours[0] + " " + this.i18n.getText("lblHours");
						}
					}
				}
			}
			this.getView().byId("scheduleWeekDaysTable").getModel().updateBindings();
			this.getView().byId("scheduleMonthDaysTable").getModel().updateBindings();
			setTimeout(function () {
				utils.loadStyle(that.oModel.getData(), that);
				that.getView().setBusy(false);
			}, constants.timeouts.schedule);
			constants.timeouts.schedule = 0;

		},
		/**
		 * Botón back pulsado. Navegamos hacia la pantalla anterior. 
		 */
		onPressBack: function () {

			var oHistory = History.getInstance();
			var sPreviousHash = oHistory.getPreviousHash();

			if (sPreviousHash !== undefined) {
				window.history.go(-1);
			} else {
				this.oRouter.navTo("home", true);
			}

		},
		/**
		 * Desde la vista móvil, al pulsar en un día se nos muestra la información de dicho día.
		 * @param {string} day: día pulsado.
		 */
		/*mobileDayInfo: function (day) {

			var data = [],
				dataLayout = this.oModel.getData().dataLayout,
				dataModel,
				i,
				days = $(".scheduleMonthDaysTable>table>tbody>tr>td>.scheduleColumnItem:not(.otherMonthDay)"),
				daysText = $(".scheduleMonthDaysTable>table>tbody>tr>td>.scheduleColumnItem:not(.otherMonthDay)>div>.textXL"),
				hourEntryText,
				hourExitText,
				hourEstimatedText,
				currMonth = dataLayout.navDate.getMonth(),
				currYear = dataLayout.navDate.getFullYear(),
				notApt = "N/A";

			data.push({});

			for (i = 0; i < days.length; i++) {
				if (day === daysText[i].innerText) {
					break;
				}
			}

			data[0].date = utils.stringifyDate(new Date(currYear, currMonth, day), 1);
			hourEntryText = days[i].children[1].children[0].innerText;
			hourExitText = days[i].children[1].children[2].innerText;
			hourEstimatedText = days[i].children[2].children[0].innerText;

			if (hourEntryText === this.i18n.getText("lblDay")) {
				data[0].hourEntry = notApt;
				data[0].hourExit = notApt;
				data[0].hourEstimated = this.i18n.getText("lblDay") + " " + this.i18n.getText("lblFree");
			} else {
				data[0].hourEntry = hourEntryText;
				data[0].hourExit = hourExitText;
				data[0].hourEstimated = hourEstimatedText;
			}

			dataModel = new JSONModel(data);
			this.getView().byId("mobileDetailsTable").setModel(dataModel);

		},*/
		/** 
		 * Botón de navegación entre meses pulsado. Carga la información del mes anterior o el siguiente, dependiendo del botón pulsado.
		 * @param {Object} oEvent: botón pulsado.
		 */
		onPressMonthNav: function (oEvent) {

			var navDate = this.oModel.getData().dataLayout.navDate,
				year = navDate.getFullYear(),
				month = navDate.getMonth();

			//this.onPressUndoSelect();

			if (oEvent.getSource().getId().includes("back")) {
				navDate = new Date(year, month - 1, 1);
			} else if (oEvent.getSource().getId().includes("frwd")) {
				navDate = new Date(year, month + 1, 1);
			}

			this.oModel.getData().dataLayout.navDate = navDate;
			this.getMonthlySchedule(navDate);

		},
		/**
		 * Número de día del calendario mensual pulsado. Redirige al usuario a la vista de detalle del registro del día seleccionado, si existe
		 * un registro ese día. En caso contrario, muestra un mensaje de error.
		 * @param {Object} oEvent: celda pulsada.
		 */
		onPressCell: function (oEvent) {

			var recordData = sap.ui.getCore().getModel("userSessions").getData(),
				navDate = this.oModel.getData().dataLayout.navDate,
				currDay = oEvent.getSource().getText(),
				currMonth = navDate.getMonth(),
				currYear = navDate.getFullYear(),
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				msg = i18n.getText("msgNonExistentRecord"),
				urlSCPProcedure = constants.api.urlGetRecord,
				that = this,
				editData,
				editDataModel,
				auxinittime,
				inittime,
				auxendtime,
				endtime;

			recordData.recordinitdate = new Date(currYear, currMonth, currDay, 12, 0, 0);
			var minDate = null;

			try {
				var parameters = that.oModel.getData().parameters;
				if (parameters['DAS-workdayNumberShow']) {
					var dateOffset = (24 * 60 * 60 * 1000) * parameters["DAS-workdayNumberShow"].value; //5 days
					minDate = new Date();
					minDate.setTime(minDate.getTime() - dateOffset);
				}
			} catch (e) {
				console.log(e);
			}
			
			/*Añadida la obtención de los textos custom*/
			try {
				var customText = that.oModel.getData().customText;
			} catch (e) {
				console.log(e);
			}

			if (minDate && recordData.recordinitdate.getTime() < minDate.getTime() || recordData.recordinitdate > new Date().setHours(23,0,0)) {
				utils.showErrorMessage(i18n.getText('msgCantReadRecord'), 2500);
			} else {
				dbutils.DBPost(urlSCPProcedure, recordData, i18n, function (data) {
					if (data.length !== 0) {
						if (data[0].recordinittime !== null) {
							auxinittime = data[0].recordinittime.split("T")[1].split(":");
							data[0].recordinittime = new Date(currYear, currMonth, currDay, auxinittime[0], auxinittime[1], auxinittime[2].substr(0, 2)).getTime();
							inittime = new Date(data[0].recordinittime).toTimeString().split(" ")[0].substr(0, 5);
						} else {
							inittime = "";
						}
						if (data[0].recordendtime !== null) {
							auxendtime = data[0].recordendtime.split("T")[1].split(":");
							data[0].recordendtime = new Date(currYear, currMonth, currDay, auxendtime[0], auxendtime[1], auxendtime[2].substr(0, 2)).getTime();
							endtime = new Date(data[0].recordendtime).toTimeString().split(" ")[0].substr(0, 5);
						} else {
							endtime = "";
						}
						editData = {
							recordinitdate: utils.stringifyDate(new Date(data[0].recordinitdate), 1),
							recordinittime: data[0].recordinittime,
							inittimestring: inittime,
							recordendtime: data[0].recordendtime,
							endtimestring: endtime,
							editinittime: data[0].editinittime,
							editendtime: data[0].editendtime,
							editrestingtime: data[0].editrestingtime,
							checkextrahours: data[0].checkextrahours === 1 ? true : false,
							checkgoodpractices: data[0].checkgoodpractices === 1 ? true : false,
							totalrestingtime: Math.floor(parseFloat(data[0].totalrestingtime / 60)),
							correctData: true,
							customText: customText
						};

						//console.log(editData);
						editDataModel = new JSONModel(editData);
						that.getOwnerComponent().setModel(editDataModel, "editRegistry");
						that.oRouter.navTo("edit-registry");
					} else {
						utils.showErrorMessage(msg);
					}
				});
			}
		}

	});

});