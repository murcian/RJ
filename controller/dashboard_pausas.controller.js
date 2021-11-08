/* global constants:true, utils:true, dbutils:true, moment:true */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/format/DateFormat",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Sorter",
	"sap/ui/core/util/File",
	"sap/ui/Device",
	"epicfichajes/epicfichajes/utils/formatter",
	"epicfichajes/epicfichajes/model/status"
], function (Controller, DateFormat, JSONModel, Sorter, File, Device, formatter, Status) {
	"use strict";

	var bWorkingOnAbsenceDay = false;
	var oController;
	var iTimeExceeded;
	var bPopUpExcessReady = true;
	var iCountInactivity = 0,
		iInactivityInterval = 400,
		oView;

	return Controller.extend("epicfichajes.epicfichajes.controller.Dashboard_pausas", {

		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf epicfichajes.epicfichajes.view.dashboard
		 */
		onInit: function () {

			this.oRouter = sap.ui.core.UIComponent.getRouterFor(this); //Componente de navegación
			this.oModel = new JSONModel("./model/dashboard.json");
			this.oRouter.getRoute("home_pausas").attachPatternMatched(this.viewRender, this);
			Device.resize.attachHandler(this.windowSize, this);
			this.aEditableDays = [];
			oController = this;

			this.setInactivityTimer();
			oView = this.getView();
		},

		onAfterRendering: function () {
			this.getView().byId("imgBanner").setSrc(formatter.setBanneImage());
		},

		windowSize: function (mParams) {
			/*var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				oLblSchedule = this.getView().byId("mySchedule"),
				oLblReducedTime = this.getView().byId("reducedTime"),
				oLblReducedSchedule = this.getView().byId("reducedSchedule"),
				oModelReducedSchedule = this.getView().getModel("oModelReducedSchedule"),
				oModelReducedScheduleData = oModelReducedSchedule.getData();

			if (mParams.width <= 800) {
				oLblSchedule.setText("H:");
				oLblReducedTime.setText("JHR (" + oModelReducedScheduleData.reducedpercentage + "%)");
				oLblReducedSchedule.setText("HHTT: " + oModelReducedScheduleData.reducedSchedule);
			} else {
				oLblSchedule.setText(i18n.getText("lblTimeSchedule"));
				oLblReducedTime.setText("Jornada con horario reducido (" + oModelReducedScheduleData.reducedpercentage + "%)");
				oLblReducedSchedule.setText("Mis horas teóricas: " + oModelReducedScheduleData.reducedSchedule);
			}*/

		},
		/**
		 * Función invocada cada vez que se entra a la vista. Comprueba que existan credenciales de usuario y carga los datos
		 * de sus jornadas. En caso contrario redirecciona a la pantalla de login.
		 */
		viewRender: function () {
			/*onBeforeRendering: function () {*/
			var that = this,
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				todayDate = new Date(),
				today = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 12, 0, 0),
				firstShowDate,
				postData = {},
				postDataCT = {},
				oView = this.getView(),
				urlParameters = constants.api.urlGetParameterization,
				urlCustomText = constants.api.urlGetCustomText,
				oModelData;

			oView.setBusyIndicatorDelay(0);
			oView.setBusy(true);

			if (this.oModel) {
				oModelData = this.oModel.getData();

				if (oModelData.timeInterval !== null) {
					clearInterval(oModelData.timeInterval);
					oModelData.timeInterval = null;
				}
			}
			dbutils.checkConnection(this.oRouter, i18n, oView.getId(), that, function () {
				that.oModel = new JSONModel("./model/dashboard.json"); //Modelo de datos independiente del backend
				that.oModel.attachRequestCompleted(function () {
					var idcompany = sap.ui.getCore().getModel("userSessions").getData().idcompany;
					postData.idcompany = idcompany;

					//OBTENER PARÁMETROS DE LA EMPRESA
					dbutils.DBPost(urlParameters, postData, i18n, function (parameters) {
						// BEGIN 25/11/2020 - DPV -- Navigation to duplicate dashboard_pausas view if breaks are active for the user
						var iRestParameterIndex = parameters.findIndex(function (el) {
							return el.pkey === "GEN-workdayHasRests";
						});
						//parameters[iRestParameterIndex].value = "true"; //IMPORTANT, TEST PURPOSES ONLY ERASE BEFORE DEPLOY
						if (parameters[iRestParameterIndex].value === "false") {
							that.oRouter.navTo("home", true);
						} else {
							// END 25/11/2020 - DPV
							utils.prepareGlobalParameters(parameters, that, JSONModel, function () {
								var userData = sap.ui.getCore().getModel("userSessions").getData();
								var postUserData = {
									"idemployee": userData.idemployee,
									"startdate": userData.startdate,
									"initdate": utils.stringifyDate(new Date(), 2),
									"enddate": utils.stringifyDate(new Date(), 2),
									"lng": userData.language
								}

								dbutils.DBPost("/workschedules/getWorkScheduleEmployeeByDate.xsjs", postUserData, i18n, function (employeeSchedule) {
									var filteredSchedule = employeeSchedule.filter(function (elem) {
										return elem.numday === ((new Date()).getDay() !== 0 ? (new Date()).getDay() : 7);
									})[0];

									that.getView().setModel(new JSONModel({
										plannedHours: filteredSchedule.plannedhours,
										reducedworkingday: sap.ui.getCore().getModel("userSessions").getData().reducedworkingday ? true : false,
										reducedpercentage: (sap.ui.getCore().getModel("userSessions").getData().reducedpercentage ? sap.ui.getCore().getModel(
											"userSessions").getData().reducedpercentage : 0).toFixed(2),
										reducedSchedule: utils.secondsToHoursAndMinutes(filteredSchedule.plannedhours * 60 * 60)
									}), "oModelReducedSchedule");

									var noRestDays = filteredSchedule.noRestDays,
										weekDay = new Date().getDay() === 0 ? 7 : new Date().getDay();

									if (noRestDays && noRestDays.indexOf(weekDay) !== -1) {
										that.oModel.getData().parameters["GEN-MandatoryRest"].value = "false";
									}

									if (filteredSchedule.minWorkTimeForRest && filteredSchedule.mandatoryRestTime) {
										try {
											that.oModel.getData().parameters['GEN-MandatoryRestTime'].value = filteredSchedule.mandatoryRestTime;
											that.oModel.getData().parameters['GEN-MinWorkTimeForRest'].value = filteredSchedule.minWorkTimeForRest;
										} catch (err) {
											that.oModel.getData().parameters['GEN-MandatoryRestTime'] = {
												value: filteredSchedule.mandatoryRestTime
											};
											that.oModel.getData().parameters['GEN-MinWorkTimeForRest'] = {
												value: filteredSchedule.minWorkTimeForRest
											};
										}
									}
								});
							});
							utils.loadParameters(that.oModel.getData(), that);

							that.getTodayRecord(that);
							firstShowDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), (todayDate.getDate() - parseFloat(that.oModel.getData()
								.parameters["DAS-workdayNumberShow"].value)), 12, 0, 0);

							//Limitar registros que se pueden ver dependiendo de la parametrización
							var minDate = new Date(new Date().getTime() - (24 * 60 * 60 * 1000) * that.oModel.getData().parameters[
								"DAS-workdayNumberShow"].value);
							minDate.setHours(0, 0, 0);
							that.getView().byId("datePicker").setMinDate(minDate);

							var maxDate = new Date();
							maxDate.setHours(0, 0, 0);
							that.getView().byId("datePicker").setMaxDate(maxDate);

							if (that.getView().byId("datePicker").getDateValue() && that.getView().byId("datePicker").getSecondDateValue()) {
								that.getAllEmployeeRecords(that.getView().byId("datePicker").getDateValue(), that.getView().byId("datePicker").getSecondDateValue());
							}

							//Se comenta que no se recargue el filtro horario al volver de editar una fecha	
							//that.getAllEmployeeRecords(firstShowDate, today); 
							that.onDateRangeChange();
							setTimeout(function () {
								that.windowSize({
									"width": window.innerWidth,
									"height": window.innerHeight
								});
								oView.setBusy(false);
							}, constants.timeouts.dashboard);
							constants.timeouts.dashboard = 0;

							//OBTENER TEXTOS PERSONALIZADOS
							postDataCT = {
								idcompany: sap.ui.getCore().getModel("userSessions").getData().idcompany,
								idoffice: sap.ui.getCore().getModel("userSessions").getData().idoffice,
								language: sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2).toUpperCase()
							};

							dbutils.DBPost(urlCustomText, postDataCT, i18n, function (parameters) {
								//Guardar parameters en un modelo
								utils.prepareCustomText(parameters, that, JSONModel);
								utils.loadCustomText(that.oModel.getData(), that);

								// Comprobamos si el check de politica de seguridad se ha aceptado.
								if (that.oModel.getData().parameters['GEN-checkSecurityPolicy'].visible) {
									var oModelUser = sap.ui.getCore().getModel("userSessions").getData();
									if (!oModelUser.checkedsecuritypolicy) {
										that.openDialogSecurityPol();
									}
								}

							});

							//Comprobamos si los roles están activos para la compañía
							if (that.oModel.getData().parameters['GEN-enabledRoles'].visible) {

								//Comprobamos si tiene activo el de el fichaje en un marco horario
								if (that.oModel.getData().parameters['ROL-entradaRestrVent'] && that.oModel.getData().parameters['ROL-entradaRestrVent']
									.value) {
									var postData = {
										"idrol": that.oModel.getData().parameters['ROL-entradaRestrVent'].value
									};
									postData.idemployee = sap.ui.getCore().getModel("userSessions").getData().idemployee;
									postData.startdate = sap.ui.getCore().getModel("userSessions").getData().startdate;
									postData.idcompany = sap.ui.getCore().getModel("userSessions").getData().idcompany;
									postData.idoffice = sap.ui.getCore().getModel("userSessions").getData().idoffice;

									//OBTENER ROLES DEL EMPLEADO
									dbutils.DBPost(constants.api.urlEmployeeRoles, postData, i18n, function (parameters) {
										if (parameters.length > 0) {
											var rolParm = {
												idrol: parameters[0].idrol,
												activemp: parameters[0].activemp,
												activerol: parameters[0].activerol,
												idval: parameters[0].idval,
												intval: parameters[0].intval,
												initdate: parameters[0].initdate,
												enddate: parameters[0].enddate,
												inittime: parameters[0].inittime,
												endtime: parameters[0].endtime
											};
											that.getView().oModels["userData"].getData().roles = {};
											that.getView().oModels["userData"].getData().roles['ROL-entradaRestrVent'] = rolParm;
										}
									});
								}
							}
						}
					});

					// postDataCT = {
					// 	idcompany: sap.ui.getCore().getModel("userSessions").getData().idcompany,
					// 	idoffice: sap.ui.getCore().getModel("userSessions").getData().idoffice,
					// 	language: sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2)
					// };

					// //OBTENER TEXTOS PERSONALIZADOS
					// dbutils.DBPost(urlCustomText, postDataCT, i18n, function (parameters) {
					// 	//Guardar parameters en un modelo
					// 	utils.prepareCustomText(parameters, that, JSONModel);
					// 	utils.loadCustomText(that.oModel.getData(), that);
					// });

					// JBV - 21/02/2020 - Inicio modificación jornada reducida
					var userData = sap.ui.getCore().getModel("userSessions").getData();
					var postUserData = {
							"idemployee": userData.idemployee,
							"startdate": userData.startdate,
							"initdate": utils.stringifyDate(new Date(), 2),
							"enddate": utils.stringifyDate(new Date(), 2),
							"lng": userData.language
						}
						// JBV - 21/02/2020 - Final modificación jornada reducida
				});

				// JBV - 13/07/2020 - Ampliación de espectro para validación de las franjas horarias. 
				var now = new Date();
				if (moment.tz(now, sap.ui.getCore().getModel("userSessions").getData().timezone)._offset !== moment.tz(now, moment.tz.guess())
					._offset &&
					sap.ui.getCore().getModel("userSessions").getData().timezone) {
					that.showInformativePopup("Advertencia",
						"La zona horaria indicada en Succesfactors es diferente a la Zona Horaria de su ordenador, considere esta diferencia al realizar su registro de Jornada."
					);
				}
				// JBV - 13/07/2020 - Ampliación de espectro para validación de las franjas horarias. 
			});
		},
		/**
		 * Recupera todos los registros de empleado de la BBDD comprendidos entre el rango de fechas especificado.
		 * @param initDate fecha mínima de los registros a recuperar.
		 * @param endDate fecha máxima de los registros a recuperar.
		 */
		getAllEmployeeRecords: function (initDate, endDate) {
			var that = this,
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				urlSCPProcedure = constants.api.urlGetAllRecords,
				postData = sap.ui.getCore().getModel("userSessions").getData(),
				oView = this.getView(),
				oModelWorkDaysData,
				listItems,
				i,
				j,
				today = new Date();

			postData.recordinitdate = initDate;
			postData.recordenddate = endDate;
			postData.offset = utils.getOffset(today);

			oView.setModel(sap.ui.getCore().getModel("userSessions"), "userData");
			dbutils.DBPost(urlSCPProcedure, postData, i18n, function (data) { //Llamada a base de datos
					utils.treatRecordsFromDatabase(data, i18n, Status);
					that.oModelWorkDays = new JSONModel(data);
	
					if (that.aEditableDays.length === 0 && data.length > 0) {
						that.aEditableDays.push(utils.stringifyDate(new Date(), 1));
	
						if (utils.stringifyDate(new Date(), 1) === data[0].recordinitdate && data[1]) {
							that.aEditableDays.push(data[1].recordinitdate);
						} else if (data[0].recordinitdate !== utils.stringifyDate(new Date(), 1)) {
							that.aEditableDays.push(data[0].recordinitdate);
						}
					}
	
					oModelWorkDaysData = that.oModelWorkDays.getData();
					for (i = 0; i < oModelWorkDaysData.length; i++) {
						oModelWorkDaysData[i].inittimestring = new Date(utils.reverseOffset(oModelWorkDaysData[i].recordinittime)).toTimeString().split(
							" ")[0].substr(0, 5);
						if (oModelWorkDaysData[i].recordendtime !== "" && oModelWorkDaysData[i].recordendtime !== null) {
							oModelWorkDaysData[i].endtimestring = new Date(utils.reverseOffset(oModelWorkDaysData[i].recordendtime)).toTimeString().split(
								" ")[0].substr(0, 5);
						}
	
					}
					utils.loadParameters(oModelWorkDaysData, that);
	
					if (data.length === 0) {
						that.oModelWorkDays = new JSONModel([]);
					}
	
					oView.byId("workDaysInfoTable").setModel(that.oModelWorkDays);
					listItems = oView.byId("workDaysInfoTable").getItems();
					if (oModelWorkDaysData.parameters["GEN-detailVisibility"].visible) {
						for (j = 0; j < listItems.length; j++) {
							listItems[j].setType(sap.m.ListType.Active);
						}
					} else {
						for (j = 0; j < listItems.length; j++) {
							listItems[j].setType(sap.m.ListType.Inactive);
						}
					}
					oView.byId("workDaysInfoTable").getModel().updateBindings();
				});
		},
		/**
		 * Recupera, si existe, el registro de la jornada en curso para poder mantener estado de ésta si cambiamos
		 * de ventana o cerramos la aplicación, y carga la jornada prevista del día actual.
		 */
		getTodayRecord: function (that) {

			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				//urlSCPProcedureSchedule = constants.api.urlGetWorkScheduleEmployeeByDate,
				urlSCPProcedureRecord = constants.api.urlGetRecord,
				urlSCPProcedureAbsences = constants.api.urlGetHolidays,
				//urlSCPProcedureCalendars = constants.api.urlGetCalendars,
				recordData = sap.ui.getCore().getModel("userSessions").getData(),
				scheduleData = sap.ui.getCore().getModel("userSessions").getData(),
				state,
				oModelData = this.oModel.getData(),
				today = new Date(),
				//currYear = today.getFullYear(), currMonth = today.getMonth(), currDay = today.getDate(), compareDate, initTime, endTime,
				weekDay = utils.getWeekDay(today) - 1,
				lng = sap.ui.getCore().getConfiguration().getLanguage().toUpperCase(),
				i = 0,
				userSessionsData = sap.ui.getCore().getModel("userSessions").getData();

			if (lng.length > 2) {
				lng = lng.split("-")[0].toUpperCase();
			}

			recordData.recordinitdate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
			recordData.offset = utils.getOffset(today);
			scheduleData.initdate = utils.stringifyDate(recordData.recordinitdate, 2);
			scheduleData.enddate = utils.stringifyDate(recordData.recordinitdate, 2);
			scheduleData.lng = lng;
			scheduleData.startdate = scheduleData.startdate.split("T")[0];

			dbutils.DBPost(urlSCPProcedureRecord, scheduleData, i18n, function (data) { //Llamada a base de datos
				if (data.length !== 0) {
					oModelData.totalWorkTime = parseFloat(data[0].totalworkingtime);
					oModelData.totalRestTime = parseFloat(data[0].totalrestingtime);
					utils.treatRecordsFromDatabase(data, i18n, Status);
					state = data[0].idstatus;
					oModelData.todayRecord = data[0];
					oModelData.todayRecord.limitLock = new Date(oModelData.todayRecord.lastrecord).setMinutes(new Date(oModelData.todayRecord.lastrecord)
						.getMinutes() + parseFloat(oModelData.parameters["DAS-btnLockTime"].value));
				} else {
					state = constants.workDayState.beforeWorkDay;
				}

				oModelData.state = state;

				if (oModelData.parameters["GEN-enabledHolidays"].value === "false" && oModelData.parameters["GEN-enabledCalendars"].value ===
					"false" && oModelData.parameters["GEN-enabledSchedules"].value === "false") {
					oModelData.controlVariables.workingDay = true;
					that.setWorkDayState(oModelData);
				} else {
					//VACACIONES DEL EMPLEADO
					if (oModelData.parameters["GEN-enabledHolidays"].value === "true") {
						dbutils.DBPost(urlSCPProcedureAbsences, scheduleData, i18n, function (absences) {
							if (oModelData.controlVariables.noWorking === false) {
								if (absences.length !== 0) {
									for (i = 0; i < absences.length; i++) {
										/*INI LZ 14/01/2020 Corrección lógica de ausencias*/
										var fromDate = new Date(absences[i].initdate),
											toDate = new Date(absences[i].enddate),
											today = new Date();

										//INI JBV 14/02/2020 Corrección lógica de ausencias 2
										toDate.setHours(22, 59);
										fromDate.setHours(0, 0);
										//FIN JBV 14/02/020 Corrección lógica de ausencias 2

										/*INI - 10/11/2020 - TGTJORN-111 - @jgalaber - Añadir la comparación del parámetro de la compañía que controla si se puede fichar en festivos o no */
										/*
											··· Codigo Antiguo ···
											if (today.getTime() <= toDate.getTime() && today.getTime() >= fromDate.getTime()) {
										*/
										if (today.getTime() <= toDate.getTime() && today.getTime() >= fromDate.getTime() && oModelData.parameters[
												"GEN-PICKONABSENCES"].value === "false") {
											/*FIN - 10/11/2020 - TGTJORN-111 - @jgalaber - Añadir la comparación del parámetro de la compañía que controla si se puede fichar en festivos o no */

											// compareDate = new Date(absences[i].initdate);
											// if (compareDate.getFullYear() === currYear && compareDate.getMonth() === currMonth && compareDate.getDate() === currDay) {
											/*FIN LZ 14/01/2020*/
											oModelData.controlVariables.currentDaySchedule = i18n.getText("lblToday") + " (" + i18n.getText("lblDay") + " " + i18n.getText(
												"lblAbsence") + ")";
											oModelData.controlVariables.noWorking = true;
											oModelData.controlVariables.workingDay = false;
										} else {
											/*if(oModelData.parameters["GEN-PICKONABSENCES"].value === "true"){
												oModelData.controlVariables.currentDaySchedule = i18n.getText("lblToday") + " (" + i18n.getText("lblDay") + " " + i18n.getText("lblAbsence") + ")";
												bWorkingOnAbsenceDay = true;
											}*/
											oModelData.controlVariables.noWorking = false;
											oModelData.controlVariables.workingDay = true;
										}
									}
								} else {
									oModelData.controlVariables.noWorking = false;
									oModelData.controlVariables.workingDay = true;
								}
								// if ((oModelData.parameters["GEN-enabledCalendars"].value === "false" && oModelData.parameters["GEN-enabledSchedules"].value ===
								// 		"false") || oModelData.controlVariables.noWorking === true) {
								// 	that.setWorkDayState(oModelData);
								// }

								//SI no tiene vacaciones, se mira si tiene festivo y horario
								if (oModelData.controlVariables.workingDay === true) {
									that.getPosibleAbsences();
								}

								that.setWorkDayState(oModelData);
							}
						});
					}
				}
			});
		},
		/**
		 * Función que recupera las ausencias y los festivos en el caso de NO TENER VACACIONES - si tenemos vacaciones no se mira nada de todo esto
		 */
		getPosibleAbsences: function () {
			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				urlSCPProcedureSchedule = constants.api.urlGetWorkScheduleEmployeeByDate,
				urlSCPProcedureCalendars = constants.api.urlGetCalendars,
				scheduleData = sap.ui.getCore().getModel("userSessions").getData(),
				oModelData = this.oModel.getData(),
				today = new Date(),
				currYear = today.getFullYear(),
				currMonth = today.getMonth(),
				currDay = today.getDate(),
				compareDate,
				initTime,
				endTime,
				weekDay = utils.getWeekDay(today) - 1,
				lng = sap.ui.getCore().getConfiguration().getLanguage().toUpperCase(),
				i = 0,
				userSessionsData = sap.ui.getCore().getModel("userSessions").getData(),
				that = this;

			//FESTIVOS DEL EMPLEADO
			if (oModelData.parameters["GEN-enabledCalendars"].value === "true") {
				dbutils.DBPost(urlSCPProcedureCalendars, scheduleData, i18n, function (holidays) {
					if (oModelData.controlVariables.noWorking === false) {

						if (holidays.length !== 0 && oModelData.parameters["GEN-PICKONABSENCES"].value === "false") {
							for (i = 0; i < holidays.length; i++) {
								compareDate = new Date(holidays[i].datecal);
								if (compareDate.getFullYear() === currYear && compareDate.getMonth() === currMonth && compareDate.getDate() === currDay) {
									oModelData.controlVariables.currentDaySchedule = i18n.getText("lblToday") + " (" + i18n.getText("lblDay") + " " + i18n.getText(
										"lblHoliday") + ")";
									oModelData.controlVariables.noWorking = true;
									oModelData.controlVariables.workingDay = false;
								}
							}
						} else {
							if (holidays.length !== 0 && oModelData.parameters["GEN-PICKONABSENCES"].value === "true") {
								oModelData.controlVariables.currentDaySchedule = i18n.getText("lblToday") + " (" + i18n.getText("lblDay") + " " + i18n.getText(
									"lblAbsence") + ")";
								bWorkingOnAbsenceDay = true;
							}
							oModelData.controlVariables.noWorking = false;
							oModelData.controlVariables.workingDay = true;
						}
						that.setWorkDayState(oModelData);
					}
					// if (oModelData.parameters["GEN-enabledSchedules"].value === "false") {
					// 	that.setWorkDayState(oModelData);
					// }
				});
			}

			//HORARIO PLANIFICADO DEL EMPLEADO
			if (oModelData.parameters["GEN-enabledSchedules"].value === "true") {

				var userData = sap.ui.getCore().getModel("userSessions").getData();
				var postUserData = {
					"idemployee": userData.idemployee,
					"startdate": userData.startdate,
					"initdate": utils.stringifyDate(new Date(), 2),
					"enddate": utils.stringifyDate(new Date(), 2),
					"lng": userData.language
				}

				dbutils.DBPost(urlSCPProcedureSchedule, postUserData, i18n, function (schedule) {
					if (oModelData.controlVariables.noWorking === false) {
						if (schedule.length !== 0) {
							if (schedule[weekDay].plannedhours !== "0" || (schedule[weekDay].plannedhours === "0" && oModelData.parameters[
									"GEN-PICKONABSENCES"].value === "true")) {
								initTime = utils.getTimeFormat(schedule[weekDay].wsdm_inittime);
								endTime = utils.getTimeFormat(schedule[weekDay].wsdm_endtime);
								oModelData.controlVariables.currentDaySchedule = i18n.getText("lblToday") + " (" + initTime + " - " + endTime + ")";
								oModelData.controlVariables.workingDay = true;
								if (userSessionsData.reducedworkingday !== 1) {
									oModelData.controlVariables.plannedMinutes = parseFloat(schedule[weekDay].plannedhours) * 60;
								} else if (schedule[weekDay].plannedhours !== "0") {
									oModelData.controlVariables.plannedMinutes =
										(parseFloat(schedule[weekDay].plannedhours)) * 60;
								}

								oModelData.controlVariables.noWorking = false;
								if (schedule[weekDay].plannedhours === "0" && oModelData.parameters["GEN-PICKONABSENCES"].value === "true")
									bWorkingOnAbsenceDay = true;
							} else {
								oModelData.controlVariables.currentDaySchedule = i18n.getText("lblToday") + " (" + i18n.getText("lblDay") + " " +
									i18n.getText("lblFree") + ")";
							}
						} else {
							oModelData.controlVariables.currentDaySchedule = i18n.getText("lblToday") + " (" + i18n.getText("actNo") + " " +
								i18n.getText(
									"lblPlanned") + ")";
							//Para evitar que se pueda fichar sin tener horario asignado descomentar estas líneas
							//oModelData.controlVariables.noWorking = true;
							//oModelData.controlVariables.workingDay = false;

						}
						that.setWorkDayState(oModelData);
					}
				});
			}
		},
		
		/**
		 * Función que recoge los datos de la jornada actual al pulsar el botón para cambiar de estado y los manda a la base
		 * de datos para actualizar el registro de la jornada en curso.
		 * @param {Object} additionalData: datos adicionales que pueden ser o no necesarios para el post.
		 */
		postDailyRecord: function (additionalData, callback) {
			var that = this,
				urlSCPProcedure = constants.api.urlPostRecordBreaks,
				postData = sap.ui.getCore().getModel("userSessions").getData(),
				oModelData = this.oModel.getData(),
				todayRecord = oModelData.todayRecord,
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				todayDate = new Date(),
				today = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 12, 0, 0),
				firstShowDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), (todayDate.getDate() - parseFloat(oModelData.parameters[
					"DAS-workdayNumberShow"].value)), 12, 0, 0),
				msg;

			if (additionalData.idresttype === 1) {
				oModelData.state = constants.workDayState.afterWorkDay;
			}

			postData.idstatus = oModelData.state;
			postData.editinittime = ""; //oModelData.todayRecord.editinittime;
			postData.editendtime = "";
			postData.editrestingtime = "";
			postData.invalidRecord = "";
			postData.idregtype = constants.regType.manual;
			postData.offset = utils.getOffset(todayDate);

			if (additionalData.idresttype !== null) {
				postData.idresttype = additionalData.idresttype;
				postData.restdetail = additionalData.restdetail;
			} else {
				switch (oModelData.state) {
				case constants.workDayState.resting:
					postData.restdetail = i18n.getText("lblNotSpecified");
					break;
				case constants.workDayState.afterWorkDay:
					postData.idresttype = 1;
					break;
				default:
					postData.idresttype = additionalData.idresttype;
					postData.restdetail = additionalData.restdetail;
					break;
				}
			}

			postData.totalexcesstime = additionalData.totalexcesstime;

			if (additionalData.hasOwnProperty("extraHours")) {
				postData.extraHours = additionalData.extraHours;
			}
			if (additionalData.hasOwnProperty("checkgoodpractices")) {
				postData.checkgoodpractices = additionalData.checkgoodpractices ? 1 : 0;
			}
			if (additionalData.hasOwnProperty("checkextrahours")) {
				postData.checkextrahours = additionalData.checkextrahours ? 1 : 0;
			}

			if (todayRecord.hasOwnProperty("recordinittime")) {
				postData.recordinittime = todayRecord.recordinittime;
			} else {
				postData.recordinittime = utils.getOffset(todayDate);
			}
			if (additionalData.hasOwnProperty("recordendtime")) {
				postData.recordendtime = additionalData.recordendtime;
			} else if (oModelData.state === constants.workDayState.working) {
				postData.recordendtime = "";
				postData.recordenddate = "";
			} else {
				postData.recordendtime = utils.getOffset(todayDate);
				postData.recordenddate = today;
			}

			/* INI LZ 23-01-2020 Añadida verificación para tener en cuenta los registros no cerrados del día anterior*/
			if (todayRecord.hasOwnProperty("recordinitdate") && todayRecord.idstatus !== 4) {
				postData.recordinitdate = utils.voltearFecha(todayRecord.recordinitdate);
				//	postData.recordenddate = utils.voltearFecha(todayRecord.recordinitdate);
			} else {
				postData.recordinitdate = today;
			}
			/* FIN LZ 23-01-2020 */

			postData.totalworkingtime = parseInt(oModelData.totalWorkTime, 10);
			postData.totalrestingtime = parseInt(oModelData.totalRestTime, 10);

			// JBV - modificaciones tlfnca horas parametrizacion
			if (additionalData.hasOwnProperty("totalworkingtime")) {
				postData.totalworkingtime = additionalData.totalworkingtime;
			}

			if (additionalData.hasOwnProperty("totalrestingtime")) {
				postData.totalrestingtime = additionalData.totalrestingtime;
			}

			if (moment.tz.guess() !== sap.ui.getCore().getModel("userSessions").getData().timezone && sap.ui.getCore().getModel("userSessions")
				.getData().timezone !== null) {
				postData.isfraudulent = true;
			}
			// FIN modificacion flnca horas parametrizacion

			if (oModelData.state !== constants.workDayState.afterWorkDay) {
				postData.date = postData.recordinitdate;
			} else {
				postData.date = postData.recordenddate;
			}
			
			// Actualizamos el valor de RECORDINITDATE, cuando callback este definido
			if (callback){
				var tempDate = new Date(postData.recordinittime);
				postData.recordinitdate = new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), 12, 0, 0);
			}
			
			oModelData.todayRecord = postData;
			dbutils.DBPost(urlSCPProcedure, postData, i18n, function () { //Llamada a base de datos
				// DPV - Modificación pop-up fin de semana
				//if (oModelData.parameters["DAS-weekendPopup"].value) { //Descomentar el if cuando se cree el parametro
				if ((utils.getWeekDay(todayDate) >= 6 || (utils.getWeekDay(todayDate) <= 5 && todayDate.getHours() >= 21)) && oModelData.parameters[
						"GEN-NONPOPEXCEEDED"].value === "true") {
					that.showInformativePopup(i18n.getText("lblAttention"), i18n.getText("msgTlfWkndPolicy"));
				}
				//}
				// FIN - Modificación pop-up fin de semana
				oModelData.todayRecord.limitLock = new Date().setMinutes(new Date().getMinutes() + parseFloat(oModelData.parameters[
					"DAS-btnLockTime"].value));
				that.setWorkDayState(oModelData);
				that.getAllEmployeeRecords(firstShowDate, today);
				
				if (oModelData.todayRecord.limitLock !== 0 && oModelData.state !== constants.workDayState.afterWorkDay) {
					msg = i18n.getText("msgBtnLockTime", oModelData.parameters["DAS-btnLockTime"].value);
					if (oModelData.parameters["DAS-btnLockTime"].value > 0) {
						utils.showErrorMessage(msg, 10000);
					}
				}
				if (callback){
					callback();
				}
			});
		},
		/**
		 * Función que establece el estado de la jornada. Los valores y comportamientos de los distintos componentes(labels, botones, cronómetro)
		 * cambian dependiendo de este estado y se inicializan aquí.
		 * @param {Object} oModelData: modelo de datos para inicializar.
		 */
		setWorkDayState: function (oModelData) {
			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				today = new Date(),
				todayDate = utils.stringifyDate(today, 1),
				todayRecord = oModelData.todayRecord,
				startTime,
				endTime,
				totalWorkSeconds = oModelData.totalWorkTime,
				totalRestSeconds = oModelData.totalRestTime,
				workHours = Math.floor(totalWorkSeconds / 60 / 60),
				workMinutes = Math.floor(totalWorkSeconds / 60 % 60),
				workSeconds = Math.floor(totalWorkSeconds % 60),
				restHours = Math.floor(totalRestSeconds / 60 / 60),
				restMinutes = Math.floor(totalRestSeconds / 60 % 60),
				restSeconds = Math.floor(totalRestSeconds % 60),
				that = this;

			if (todayRecord.hasOwnProperty("recordinittime")) {

				startTime = new Date(utils.reverseOffset(todayRecord.recordinittime)).toTimeString().split(" ")[0];

				if (todayRecord.recordendtime === "" || todayRecord.recordendtime === null) {
					endTime = i18n.getText("lblNoEndHour");
				} else {
					endTime = new Date(utils.reverseOffset(todayRecord.recordendtime)).toTimeString().split(" ")[0];
				}

				if (!oModelData.parameters["DAS-stopwatchShowSeconds"].visible) {
					startTime = startTime.substr(0, 5);
					if (todayRecord.recordendtime !== "" && todayRecord.recordendtime !== null) {
						endTime = endTime.substr(0, 5);
					}
				}

			} else {
				startTime = i18n.getText("lblNoInitHour");
				endTime = i18n.getText("lblNoEndHour");
			}

			if (oModelData.parameters["DAS-stopwatchMode"].value === "Clock") {
				oModelData.controlVariables.mainStopwatchHours = utils.stopwatchComponentFormat(today.getHours());
				oModelData.controlVariables.mainStopwatchMinutes = utils.stopwatchComponentFormat(today.getMinutes());
				oModelData.controlVariables.mainStopwatchSeconds = utils.stopwatchComponentFormat(today.getSeconds());
			} else {
				//Inicialización de los valores de los cronómetros. Formato HH:mm:ss
				oModelData.controlVariables.mainStopwatchHours = utils.stopwatchComponentFormat(workHours);
				oModelData.controlVariables.mainStopwatchMinutes = utils.stopwatchComponentFormat(workMinutes);
				oModelData.controlVariables.mainStopwatchSeconds = utils.stopwatchComponentFormat(workSeconds);
				oModelData.controlVariables.secondaryStopwatchHours = utils.stopwatchComponentFormat(restHours);
				oModelData.controlVariables.secondaryStopwatchMinutes = utils.stopwatchComponentFormat(restMinutes);
				oModelData.controlVariables.secondaryStopwatchSeconds = utils.stopwatchComponentFormat(restSeconds);
			}
			//Fecha de la jornada actual y horas de inicio/fin de jornada estimada
			oModelData.controlVariables.todayDate = todayDate;
			oModelData.controlVariables.startTime = startTime;
			oModelData.controlVariables.endTime = endTime;

			if (!oModelData.controlVariables.workingDay && oModelData.state !== 4) {
				oModelData.state = constants.workDayState.beforeWorkDay;
			}

			switch (oModelData.state) {
				//state inicial
			case constants.workDayState.beforeWorkDay:
				//Icono de estado y su visibilidad
				oModelData.controlVariables.workDayTxtIcon = oModelData.parameters["DAS-iconPlay"].value;
				oModelData.controlVariables.workDayTxtIconV = false;
				//state de la jornada y valor del botón (play/stop)
				if (oModelData.controlVariables.workingDay) {
					oModelData.controlVariables.workDayDescription = i18n.getText("wdsMustStart");
					oModelData.controlVariables.workDayBtnText = i18n.getText("wdsStart");
				} else {
					oModelData.controlVariables.workDayDescription = i18n.getText("wdsCantStart");
					oModelData.controlVariables.workDayBtnText = i18n.getText("wdsNonWorkingDay");
					this.getView().byId("workDayBtn").setEnabled(false);
				}
				oModelData.controlVariables.workDayBtnIcon = oModelData.parameters["DAS-iconPlay"].value;
				/*if(oModelData.parameters["GEN-PICKONABSENCES"].value === "true"){
					this.getView().byId("workDayBtn").setEnabled(true);
					bWorkingOnAbsenceDay = true;
				}*/

				if (this.getView().byId("workDayBtn").getEnabled()) {
					that.checkVentanaHorariaRol(that);
				}
				break;
				//Trabajando
			case constants.workDayState.afterResting:
			case constants.workDayState.working:
				//Icono de estado y su visibilidad
				oModelData.controlVariables.workDayTxtIcon = oModelData.parameters["DAS-iconPlay"].value;
				oModelData.controlVariables.workDayTxtIconV = true;
				//state de la jornada y valor del botón (play/stop)
				oModelData.controlVariables.workDayDescription = i18n.getText("wdsStarted");
				oModelData.controlVariables.workDayBtnIcon = oModelData.parameters["DAS-iconStop"].value;
				if (oModelData.parameters["GEN-workdayHasRests"].value === "false") {
					oModelData.controlVariables.workDayBtnText = i18n.getText("wdsFinalize");
				} else {
					oModelData.controlVariables.workDayBtnText = i18n.getText("wdsStop");
				}
				//Cambios en las variables de intervalo de tiempo
				if (oModelData.timeInterval === null && oModelData.parameters["DAS-stopwatchMode"].value === "Stopwatch") {
					oModelData.timeInterval = setInterval(this.timeCount.bind(this), 1000);
				}
				/*if(oModelData.parameters["GEN-PICKONABSENCES"].value === "true"){
					this.getView().byId("workDayBtn").setEnabled(true);
				}*/
				break;
				//Descansando
			case constants.workDayState.resting:
				//Icono de estado y su visibilidad
				oModelData.controlVariables.workDayTxtIcon = oModelData.parameters["DAS-iconStop"].value;
				oModelData.controlVariables.workDayTxtIconV = true;
				//state de la jornada y valor del botón (play/stop)
				oModelData.controlVariables.workDayDescription = i18n.getText("wdsStopped");
				oModelData.controlVariables.workDayBtnIcon = oModelData.parameters["DAS-iconResume"].value;
				oModelData.controlVariables.workDayBtnText = i18n.getText("wdsResume");
				//Cambios en las variables de intervalo de tiempo
				if (utils.afterPlannedSchedule(oModelData.controlVariables.currentDaySchedule)) {
					if (oModelData.timeInterval === null && oModelData.parameters["DAS-stopwatchMode"].value === "Stopwatch") {
						oModelData.timeInterval = setInterval(this.timeCount.bind(this), 1000);
					}
				} else {
					clearInterval(oModelData.timeInterval);
					oModelData.timeInterval = null;
				}
				break;
				//Fin de jornada
			case constants.workDayState.afterWorkDay:
				//Icono de estado y su visibilidad
				oModelData.controlVariables.workDayTxtIcon = oModelData.parameters["DAS-iconStop"].value;
				oModelData.controlVariables.workDayTxtIconV = true;
				//state de la jornada y valor del botón (play/stop)
				oModelData.controlVariables.workDayDescription = i18n.getText("wdsFinished");
				oModelData.controlVariables.workDayBtnIcon = oModelData.parameters["DAS-iconPlay"].value;
				oModelData.controlVariables.workDayBtnText = i18n.getText("wdsFinish");
				oModelData.controlVariables.workingDay = false;
				this.getView().byId("workDayBtn").setEnabled(false);
				//Cambios en las variables de intervalo de tiempo
				if (oModelData.timeInterval !== null && oModelData.parameters["DAS-stopwatchMode"] === "Stopwatch") {
					clearInterval(oModelData.timeInterval);
					oModelData.timeInterval = null;
				}
				break;
			}

			if (oModelData.parameters["DAS-stopwatchMode"].value === "Clock" && oModelData.timeInterval === null) {
				oModelData.timeInterval = setInterval(this.timeCount.bind(this), 1000);
			}
			this.oModel.setData(oModelData);
			this.getView().byId("contentBox").setModel(this.oModel);
			this.getView().byId("contentBox").getModel().updateBindings();
			setTimeout(function () {
				utils.loadStyle(that.oModel.getData(), that);
			}, 500);
			//Verificación para ver si el empleado tiene el rol de ventana horaria
			// if (this.getView().byId("workDayBtn").getEnabled()) {
			// 	that.checkVentanaHorariaRol(that);
			// }
		},
		
		/**
		 * Cuando se va a iniciar un descanso, ésta función prepara los datos de dicho descanso dependiendo de lo que el usuario rellene
		 * en el dialog anterior.
		 * @param {Integer} idresttype: número identificativo correspondiente al tipo de descanso.
		 * @param {String} restdetail: descripción del tipo de descanso.
		 */
		prepareDailyRecord: function (idresttype, restdetail) {

			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				msg = i18n.getText("msgSpecifyRestReason"),
				that = this,
				oModelData = this.oModel.getData(),
				restDetailTextArea,
				reasonDialog,
				sendReasonBtn,
				exitBtn;

			if (sap.ui.getCore().byId("restDetailTextArea")) {
				restDetailTextArea = sap.ui.getCore().byId("restDetailTextArea");
			} else {
				restDetailTextArea = new sap.m.TextArea("restDetailTextArea", {
					placeholder: i18n.getText("plhRestReason")
				});
			}

			reasonDialog = new sap.m.Dialog({
				title: i18n.getText("ttlSpecifyRestReason"),
				type: 'Message',

				content: restDetailTextArea,
				buttons: [
					sendReasonBtn = new sap.m.Button({
						text: i18n.getText("actConfirm"),
						press: function () {
							restdetail = sap.ui.getCore().byId("restDetailTextArea").getValue();
							if (restdetail === "") {
								utils.showErrorMessage(msg);
							} else {
								if (idresttype === 1) {
									oModelData.state = constants.workDayState.afterWorkDay;
								} else {
									oModelData.state = constants.workDayState.resting;
								}
								that.postDailyRecord({
									idresttype: idresttype,
									restdetail: restdetail
								});
								reasonDialog.close();
							}
						}
					}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton"),
					exitBtn = new sap.m.Button({
						text: i18n.getText("actCancel"),
						press: function () {
							var oModelData = that.oModel.getData();

							oModelData.state = constants.workDayState.working;
							reasonDialog.close();
						}
					})
				],

				afterClose: function () {
					reasonDialog.destroy();
				}
			});

			restDetailTextArea.addStyleClass("restDetailTextArea");
			reasonDialog.addStyleClass("restDialog");
			sendReasonBtn.addStyleClass("primaryBtn dialogBtn");
			exitBtn.addStyleClass("secondaryBtn dialogBtn");

			if (idresttype !== null) {
				switch (idresttype) {
				case 0:
					oModelData.state = constants.workDayState.resting;
					this.postDailyRecord({
						idresttype: null,
						restdetail: restdetail
					});
					break;
				case 99:
					reasonDialog.open();
					break;
				default:
					if (idresttype === 1) {
						oModelData.state = constants.workDayState.afterWorkDay;
					} else {
						oModelData.state = constants.workDayState.resting;
					}
					this.postDailyRecord({
						idresttype: idresttype,
						restdetail: restdetail
					});
					break;
				}
			} else {
				utils.showErrorMessage(msg);
			}

		},
		/**
		 * Link de horario pulsado. Navega hacia la vista de Calendario.
		 */
		onPressSchedule: function () {
			this.oRouter.navTo("schedule");
		},
		/**
		 * Guarda el estado del check de buenas prácticas.
		 */
		onChangeCheckBox: function (oEvent) {

			var oModelData = this.oModel.getData();

			oModelData.controlVariables.goodPracticesAccepted = oEvent.getSource().getSelected();

		},
		
		/**
		 * Botón de iniciar/parar jornada presionado. Se invoca de nuevo a la función que inicializa las variables de control
		 * de la aplicación para reflejar el cambio en el estado.
		 */
		onPressWorkDay: function () {
			this.getView().byId("workDayBtn").setEnabled(false);
			var oModelData = this.oModel.getData(),
				state = oModelData.state,
				that = this,
				i18n = that.getOwnerComponent().getModel("i18n").getResourceBundle(),
				recordData = sap.ui.getCore().getModel("userSessions").getData(),
				scheduleData = sap.ui.getCore().getModel("userSessions").getData(),
				today = new Date();

			recordData.recordinitdate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
			recordData.offset = utils.getOffset(today);
			scheduleData.initdate = utils.stringifyDate(recordData.recordinitdate, 2);
			scheduleData.enddate = utils.stringifyDate(recordData.recordinitdate, 2);
			scheduleData.startdate = scheduleData.startdate.split("T")[0];

			dbutils.DBPost(constants.api.urlGetRecord, scheduleData, i18n, function (data) { //Llamada a base de datos
				if (data.length !== 0) {

					var intDateStr = data[0].recordinitdate.substring(0, data[0].recordinitdate.indexOf('T')),
						initTimeStr = data[0].recordinittime.substring(data[0].recordinittime.indexOf('T') + 1, data[0].recordinittime.indexOf('.')),
						recordInit = new Date(intDateStr + ' ' + initTimeStr);

					oModelData.totalWorkTime = parseInt(((new Date() - recordInit) / 1000), 10);
					oModelData.totalRestTime = parseInt((data[0].totalrestingtime === null || isNaN(data[0].totalrestingtime) ? 0 : data[0].totalrestingtime),
						10);
				} else {
					state = constants.workDayState.beforeWorkDay;
				}

				switch (state) {
				case constants.workDayState.beforeWorkDay: // Inicia Jornada
					var userInfo = sap.ui.getCore().getModel("userSessions").getData();
					var dialogText = i18n.getText("txtInfoJor");
					try {
						var filteredResult = that.getView().byId("workDaysInfoTable").getModel().getData().filter(function (elem) {
							return elem.recordinitdate !== utils.stringifyDate(new Date(), 1);
						}).sort(function (a, b) {
							return new Date(utils.voltearFecha(a.recordinitdate)) < new Date(utils.voltearFecha(b.recordinitdate));
						})[0];
					} catch (err) {
						console.log("No signings were found");
					}
					if (filteredResult !== undefined) {
						dbutils.DBPost(constants.api.urlGetDailyRecords, {
							idemployee: userInfo.idemployee,
							recordinitdate: utils.stringifyDate(new Date(utils.voltearFecha(filteredResult.recordinitdate)), 2),
							startdate: userInfo.startdate
						}, i18n, function (data) {
							var checkIniAutomated = false;
							var checkeEndAutomated = false;
							for (var i = 0; i < data.length; i++) {
								if (data[i].idstatus === 1 && data[i].idregtype === 1) {
									checkIniAutomated = true;
								}
								if (data[i].idstatus === 4 && data[i].idregtype === 1) {
									checkeEndAutomated = true;
								}
							}
							if (checkIniAutomated && checkeEndAutomated) {
								dialogText += "\n\n" + i18n.getText("txtInfoJorAntNoIniciada");
							} else if (!checkIniAutomated && checkeEndAutomated) {
								dialogText += "\n\n" + i18n.getText("txtInfoJorAntNoCerrada");
							} else {
								dialogText += "\n\n" + i18n.getText("txtInfoJorAntCorrecta");
							}
							if (new Date().getHours() < 21) { //MERY si son más de las 21 horas, no se muestra el popup
								that.showInformativePopup(i18n.getText("txtInformacionJornada"), dialogText);
							}
						});
					} else {
						that.showInformativePopup(i18n.getText("txtInformacionJornada"), dialogText);
					}
					state = constants.workDayState.working;
					break;
				case constants.workDayState.working: // Inicia pausa
					that.showPopupToSelectAction(state);
					state = constants.workDayState.resting;
					break;
				case constants.workDayState.resting: // Reanuda jornada
					state = constants.workDayState.afterResting;
					break;
				case constants.workDayState.afterResting: // Finaliza jornada
					that.showPopupToSelectAction(state);
					state = constants.workDayState.afterWorkDay;
					break;
				}
				if (state !== constants.workDayState.afterWorkDay && state !== constants.workDayState.resting) {
					oModelData.state = state;
					that.postDailyRecord({
						idresttype: null,
						restdetail: null,
						checkgoodpractices: that.getView().byId("acceptedGoodPractices").getSelected()
					});
				}
			});
		},
		
		showPopupToSelectAction: function(state){
			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			var oModelData = this.oModel.getData();
			var that = this;
			var	oEndWorkPopup,
				oConfirmButton,
				oCancelButton,
				oEndWorkPopupHeader,
				oEndWorkPopupGrid,
				oEndWorkPopupGridFooter,
				oEndWorkList;
			// Header del Popup
			oEndWorkPopupHeader = new sap.m.Bar({
				contentLeft: [new sap.m.Title({
					text: i18n.getText("ttlEndWorkPopover"),
					level: "H2"
				})],
				contentRight: [new sap.m.Button({
					icon: "sap-icon://decline",
					type: "Transparent",
					press: function () {
						this.getParent().getParent().close();
					}
				})]
			});
			// Body del Popup
			var listItems = [
				new sap.m.CustomListItem({
					content: [
						new sap.ui.core.Icon({
							src: "sap-icon://save"
						}),
						new sap.m.Label({
							text: i18n.getText("lblSaveNoExcess")
						})
					],
					customData: {
						key: "NoExcess"
					}
				}),
				new sap.m.CustomListItem({
					content: [
						new sap.ui.core.Icon({
							src: "sap-icon://visits"
						}),
						new sap.m.Label({
							text: i18n.getText("lblSaveExcess")
						})
					],
					customData: {
						key: "Excess"
					}
				})
			];
			if (state === constants.workDayState.working){
				listItems.push(new sap.m.CustomListItem({
					content: [
						new sap.ui.core.Icon({
							src: "sap-icon://date-time"
						}),
						new sap.m.Label({
							text: i18n.getText("lblInitPause")
						})
					],
					customData: {
						key: "StartPause"
					}
				}));
			}
			oEndWorkList = new sap.m.List({
				items: listItems,
				mode: sap.m.ListMode.SingleSelectMaster
			});
			oEndWorkPopupGrid = new sap.ui.layout.Grid({
				defaultSpan: "XL12 L12 M12 S12",
				content: [oEndWorkList]
			});
			// Footer del Popup
			oCancelButton = new sap.m.Button({
				text: i18n.getText("actCancel"),
				press: function (oEvent) {
					oEvent.getSource().getParent().getParent().close();
				}
			}).addStyleClass("popoverBtn sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton");
			oConfirmButton = new sap.m.Button({
				text: i18n.getText("actAccept"),
				press: function (oEvent) {
					var oAction = oEvent.getSource().getParent().getParent().getContent()[0].getContent()[0].getSelectedItem();
					if (oAction !== null && oAction !== undefined) {
						// Inicio de fichaje => Inicio de Pausa o inicio de fichaje => fin de fichaje
						if (state === constants.workDayState.working){
							state = constants.workDayState.resting;
							oModelData.state = state;
							// Se presiona inicio de pausa
							if(oAction.getCustomData()[0].getKey() === "StartPause"){
								that.postDailyRecord({
									idresttype: null,
									restdetail: null,
									checkgoodpractices: that.getView().byId("acceptedGoodPractices").getSelected()
								});
							}else{ // Se finaliza jornada
								// Finaliza jornada
								var fnEndRecord = function(){
									if (oAction.getCustomData()[0].getKey() === "NoExcess") {
										state = constants.workDayState.afterWorkDay;
										oModelData.state = state;
										that.postDailyRecord({
											idresttype: null,
											restdetail: null,
											checkgoodpractices: that.getView().byId("acceptedGoodPractices").getSelected()
										});
									}else {
										oView.getController().showBreaksExcessPopup();
									}
								};
								// Finaliza pausa/
								var fnEndBreak = function () {
									state = constants.workDayState.afterResting;
									oModelData.state = state;
									that.postDailyRecord({
										idresttype: null,
										restdetail: null,
										checkgoodpractices: that.getView().byId("acceptedGoodPractices").getSelected()
									}, fnEndRecord);
								};
								// Inicia pausa automatica
								that.postDailyRecord({
									idresttype: null,
									restdetail: null,
									checkgoodpractices: that.getView().byId("acceptedGoodPractices").getSelected()
								}, fnEndBreak);
							}
						}else if(state === constants.workDayState.afterResting){ // fin de pausa => fin de fichaje
							if (oAction.getCustomData()[0].getKey() === "NoExcess") {
								state = constants.workDayState.afterWorkDay;
								oModelData.state = state;
								that.postDailyRecord({
									idresttype: null,
									restdetail: null,
									checkgoodpractices: that.getView().byId("acceptedGoodPractices").getSelected()
								});
							}else {
								oView.getController().showBreaksExcessPopup();
							}
						}
						oEvent.getSource().getParent().getParent().close();
					} else {
						utils.showErrorMessage(i18n.getText("msgListItemNotSelected"));
					}
				}
			}).addStyleClass("popoverBtn sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton");
			oEndWorkPopupGridFooter = new sap.m.HBox({
				items: [oConfirmButton, oCancelButton],
				justifyContent: 'SpaceBetween'
			}).addStyleClass("sapUiSmallMarginBegin sapUiSmallMarginEnd");
			// Popover
			oEndWorkPopup = new sap.m.Popover({
				customHeader: oEndWorkPopupHeader,
				content: [oEndWorkPopupGrid],
				placement: sap.m.PlacementType.VerticalPreferredBottom,
				showArrow: false,
				footer: [oEndWorkPopupGridFooter]
			}).addStyleClass("excessBreakPopover");
			// Mostrar el popover
			oEndWorkPopup.openBy(this.getView().byId("workDayBtn"));
		},
		
		showInformativePopup: function (title, description) {
			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			var test = new sap.m.Dialog({ //"informativeExcessDialog",
				title: title,
				content: new sap.m.VBox(),
				endButton: new sap.m.Button({
					text: i18n.getText("actAccept"),
					press: function () {
						test.close();
						test.destroy();
					}
				}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton")
			}).addStyleClass("informativeExcessDialog");

			test.getContent()[0].addItem(new sap.m.HBox({
				items: [new sap.m.Text({
					text: description
				})]
			}));

			test.open();
		},
		
		/**
		 * @author Daniel Polo Villegas <daniel.polo.villegas@everis.com>
		 * Muestra y gestiona el popup de exceso de tiempo trabajado con las casuística especiales para las pausas.
		 */
		showBreaksExcessPopup: function () {

			var that = this,
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				oModel = this.oModel.getData(),
				excessDialogBreak;

			excessDialogBreak = new sap.m.Dialog("excessDialogBreak", {
				title: i18n.getText("tltPopUpExceso"),
				content: new sap.m.VBox(),
				buttons: [
					new sap.m.Button({
						text: i18n.getText("btnCancelar"),
						press: function () {
							oModel.state = constants.workDayState.afterWorkDay;
							that.postDailyRecord({
								isfraudulent: (moment.tz.guess() !== sap.ui.getCore().getModel("userSessions").getData().timezone &&
									sap.ui.getCore().getModel("userSessions").getData().timezone !== null) ? true : false
							});
							excessDialogBreak.close();
							excessDialogBreak.destroy();
						}
					}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton"),
					new sap.m.Button({
						text: i18n.getText("btnAceptar"),
						press: function () {
							var workingTimeValue = parseInt(sap.ui.getCore().byId("pickerWorkingTime").getValue().split(":")[0]) *
								3600 + parseInt(sap.ui.getCore().byId("pickerWorkingTime").getValue().split(":")[1]) * 60;
							setTimeout(function () {
								if (that.checkPopUpErrorMessages()) {
									if (workingTimeValue === null) {
										sap.ui.getCore().byId("mstrpNoInvalidTime").setVisible(true);
									} else {
										oModel.totalWorkTime -= workingTimeValue;
										oModel.totalexcesstime = workingTimeValue;
										oModel.state = constants.workDayState.afterWorkDay;
										that.postDailyRecord({
											totalWorkTime: oModel.totalWorkTime,
											totalexcesstime: oModel.totalexcesstime,
											isfraudulent: (moment.tz.guess() !== sap.ui.getCore().getModel("userSessions").getData().timezone &&
												sap.ui.getCore().getModel("userSessions").getData().timezone !== null) ? true : false
										});
										excessDialogBreak.close();
										excessDialogBreak.destroy();
									}
								}
							}, 1000);
						}
					}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton")
				]
			});

			excessDialogBreak.getContent()[0].addItem(new sap.m.HBox({
				items: [new sap.m.Text({
					text: i18n.getText("txtRegistroJornadaExcedePausas")
				}).addStyleClass("sapUiSmallMargin")]
			}));

			excessDialogBreak.getContent()[0].addItem(new sap.m.HBox("inputBoxMotivosLaborales", {
				alignItems: "Center",
				items: [
					new sap.m.Label("motivosLaborales", {
						text: i18n.getText("lblMotivosLaboralesPausas")
					}).addStyleClass("sapUiSmallMarginEnd"),
					new sap.m.TimePicker("pickerWorkingTime", {
						valueFormat: "HH:mm",
						displayFormat: "HH:mm",
						value: "00:00",
						width: "100px",
						placeholder: i18n.getText("lblIntroduzcaUnaHora"),
						change: that.validateExcessHours
					})
				]
			}).addStyleClass("sapUiSmallMargin"));

			excessDialogBreak.getContent()[0].addItem(new sap.m.VBox({
				items: [
					new sap.m.MessageStrip("mstrpNoInvalidTime", {
						text: i18n.getText("txtInvalidTime"),
						showIcon: true,
						type: "Warning",
						showCloseButton: false
					}).setVisible(false),
					new sap.m.MessageStrip("mstrpExcessPopUp", {
						showIcon: true,
						type: "Error",
						showCloseButton: false
					}).setVisible(false)
				]
			}));

			excessDialogBreak.open();

		},

		validateExcessHours: function (oEvent) {
			var that = oController,
				i18n = that.getOwnerComponent().getModel("i18n").getResourceBundle(),
				iSecsWorkingTime,
				oModel = that.oModel.getData();

			sap.ui.getCore().byId("mstrpExcessPopUp").setVisible(false);
			if (sap.ui.getCore().byId("pickerWorkingTime").getDateValue()) {
				iSecsWorkingTime = sap.ui.getCore().byId("pickerWorkingTime").getDateValue().getHours() * 3600 + sap.ui.getCore().byId(
					"pickerWorkingTime").getDateValue().getMinutes() * 60;
			} else {
				iSecsWorkingTime = null;
			}

			if (iSecsWorkingTime === null) {
				sap.ui.getCore().byId("pickerWorkingTime").setValue("00:00");
				sap.ui.getCore().byId("mstrpNoInvalidTime").setVisible(true);
			} else if (iSecsWorkingTime > 24 * 3600) {
				sap.ui.getCore().byId("pickerWorkingTime").setValue("00:00");
				sap.ui.getCore().byId("mstrpExcessPopUp").setText(i18n.getText("msgSumaHorasExcesoSuperan24"));
				sap.ui.getCore().byId("mstrpExcessPopUp").setVisible(true);
			} else if (iSecsWorkingTime > oModel.totalWorkTime + oModel.totalRestTime) {
				sap.ui.getCore().byId("pickerWorkingTime").setValue("00:00");
				sap.ui.getCore().byId("mstrpExcessPopUp").setText(i18n.getText("msgMaximoHorasSuperadas"));
				sap.ui.getCore().byId("mstrpExcessPopUp").setVisible(true);
			} else {
				sap.ui.getCore().byId("mstrpNoInvalidTime").setVisible(false);
				sap.ui.getCore().byId("mstrpExcessPopUp").setVisible(false);
			}

		},

		/**
		 * Función para calcular las horas de un timepicker en función al otro
		 * @param {integer} iSecsCalc: horas totales de exceso.
		 * @param {integer} iSecsRest: horas a restar a las totales.
		 */
		calculateTime: function (iSecsCalc, iSecsRest) {
			var iDiference = iSecsCalc - iSecsRest;
			var iDifHours = Math.floor(iDiference / 3600);
			var iDifMins = Math.floor((iDiference / 3600 - Math.floor(iDiference / 3600)) * 60);
			var sTime = iDifHours + ":" + iDifMins;
			return sTime;
		},

		/*
		 * Función para verficar que ningun mensaje de error se está mostrando en el pop up
		 */
		checkPopUpErrorMessages: function () {
			return !sap.ui.getCore().byId("mstrpExcessPopUp").getVisible() && !sap.ui.getCore().byId("mstrpNoInvalidTime").getVisible();
		},

		/**
		 * Si se superan las horas de trabajo teóricas teniendo activa la política de la empresa, al marcar el final de la jornada
		 * se llamará a esta función. Abre un popup con un check de horas extra que nos permite introducir nuestro tiempo de trabajo
		 * efectivo.
		 * @param {integer} idresttype: tipo de descanso.
		 * @param {string} restdetail: descripción del tipo de descanso.
		 */
		policyPopup: function (idresttype, restdetail) {

			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				oModelData = this.oModel.getData(),
				that = this,
				input,
				text = new sap.m.Text({
					// text: i18n.getText("msgEffectiveWorkTime")
					text: this.oModel.getData().customText["EFFECTIVEWORKTIME"].value
				}),
				dialog;
			that.dialog = dialog;
			var successBtn = new sap.m.Button({
					text: i18n.getText("actAccept"),
					press: function () {
						oModelData.state = constants.workDayState.afterWorkDay;
						that.postDailyRecord({
							idresttype: idresttype,
							restdetail: restdetail,
							extraHours: sap.ui.getCore().byId("extraHoursInput").getValue(),
							checkgoodpractices: false,
							checkextrahours: true,
							isfraudulent: (moment.tz.guess() !== sap.ui.getCore().getModel("userSessions").getData().timezone &&
								sap.ui.getCore().getModel("userSessions").getData().timezone !== null) ? true : false
						});
						that.dialog.close();
					}
				}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton"),
				exitBtn = new sap.m.Button({
					text: i18n.getText("actReject"),
					press: function () {
						oModelData.state = constants.workDayState.afterWorkDay;
						that.postDailyRecord({
							idresttype: idresttype,
							restdetail: restdetail,
							extraHours: sap.ui.getCore().byId("extraHoursInput").getValue(),
							checkgoodpractices: false,
							checkextrahours: false
						});
						that.dialog.close();
					}
				}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton");

			if (parseFloat(that.getView().getModel("oModelReducedSchedule").getData().plannedHours) < Math.floor(oModelData.totalWorkTime / 60 /
					60)) {
				/*if (oModelData.controlVariables.goodPracticesAccepted) {
					oModelData.state = constants.workDayState.afterWorkDay;
					that.postDailyRecord({
						idresttype: idresttype,
						restdetail: restdetail,
						checkgoodpractices: true
					});
				} else {*/
				input = new sap.m.Input("extraHoursInput", {
					description: i18n.getText("lblEffectiveTime"),
					value: (parseFloat(that.getView().getModel("oModelReducedSchedule").getData().plannedHours)).toFixed(2),
					liveChange: function (oEvent) {
						var sNumber = "",
							input = oEvent.getSource(),
							value = input.getValue().replace(',', '.'),
							bNotnumber = isNaN(value),
							maxHours = Math.round(parseFloat(that.getView().getModel("oModelReducedSchedule").getData().plannedHours));

						if (!bNotnumber) {
							if (value < maxHours) {
								sNumber = value;
								input.setValueState("Success");
							} else {
								sNumber = maxHours;
								input.setValueState("Warning");
								input.setValueStateText(i18n.getText("msgInvalidWorkingTime"));
							}
						}
						oEvent.getSource().setValue(sNumber);
					}
				});
				utils.popUpPolicy(that, i18n, text, input, successBtn, exitBtn);
			} else {
				oModelData.state = constants.workDayState.afterWorkDay;
				that.postDailyRecord({
					idresttype: idresttype,
					restdetail: restdetail,
					isfraudulent: (moment.tz.guess() !== sap.ui.getCore().getModel("userSessions").getData().timezone &&
						sap.ui.getCore().getModel("userSessions").getData().timezone !== null) ? true : false
				});
			}

		},
		/**
		 * Registro de la tabla de jornadas pulsado. Navega hacia la vista de edición de registro con los parámetros fecha, 
		 * hora de inicio/fin de jornada y tiempo total de descanso (el tiempo total de trabajo es calculado automáticamente).
		 * @param {Object} oEvent: objeto sobre el que se ha pulsado.
		 */
		onPressEditWorkDay: function (oEvent) {

			var selectedRegistryIndex,
				oModelData,
				totalrestingtime,
				totalworkingtime,
				editData,
				editDataModel,
				oModelDas,
				bEditable,
				aTableData,
				that = oController;

			selectedRegistryIndex = oEvent.getSource().getBindingContextPath().substr(1);
			aTableData = this.getView().byId("workDaysInfoTable").getModel().getData();
			oModelData = aTableData[selectedRegistryIndex];
			oModelDas = this.oModel.getData();
			totalrestingtime = oModelData.totalrestingtime.split(" ");
			totalworkingtime = oModelData.totalworkingtime.split(" ");

			if (this.aEditableDays[0] && this.aEditableDays[0] === oModelData.recordinitdate ||
				this.aEditableDays[1] && this.aEditableDays[1] === oModelData.recordinitdate) {
				bEditable = true;
			} else {
				bEditable = false;
			}

			editData = {
				recordinitdate: oModelData.recordinitdate,
				recordinittime: oModelData.recordinittime,
				inittimestring: oModelData.inittimestring,
				recordendtime: oModelData.recordendtime,
				endtimestring: oModelData.endtimestring,
				editinittime: oModelData.editinittime,
				editendtime: oModelData.editendtime,
				editrestingtime: oModelData.editrestingtime,
				totalrestingtime: parseFloat(totalrestingtime[0] * 60) + parseFloat(totalrestingtime[2]),
				correctData: true,
				checkextrahours: oModelData.checkextrahours === 1 ? true : false,
				checkgoodpractices: oModelData.checkgoodpractices === 1 ? true : false,
				totalworkingtime: parseFloat(totalworkingtime[0] * 60) + parseFloat(totalworkingtime[2]),
				state: oModelData.idstatus,
				plannedMinutes: oModelDas.controlVariables.plannedMinutes,
				controlVariables: oModelDas.controlVariables,
				customText: this.oModel.getData().customText,
				parameters: oModelDas.parameters,
				editable: bEditable,
				totalWorkTime: that.oModel.getData().totalWorkTime,
				recordenddate: oModelData.recordenddate,
				totalexcesstime: oModelData.totalexcesstime,
				totalexcesstimetxt: oModelData.totalexcesstimetxt,
				approvalstatus: oModelData.approvalstatus,
				approvalstatustxt: oModelData.approvalstatustxt
			};

			if (oModelData.recordendtime === null) {
				editData.recordendtime = "";
				editData.endtimestring = "";
			}

			editDataModel = new JSONModel(editData);
			this.getOwnerComponent().setModel(editDataModel, "editRegistry");
		
			var oDataParameters = this.getView().getModel("companyParameters").getData();
			var oWDayHasrest    = oDataParameters.filter(oParameter => oParameter.pkey === "GEN-workdayHasRests");
			var sNameRoute      = (oWDayHasrest[0] && oWDayHasrest[0].value === "true") ? "edit-registry-pause" : "edit-registry";
	
			this.oRouter.navTo(sNameRoute);
		},
		/**
		 * Función que ordena la tabla de registros de forma ascendente o descendente.
		 */
		onPressSortDate: function () {

			var oTable = this.getView().byId("workDaysInfoTable"),
				oBinding = oTable.getBinding("items"),
				sPath = "recordorderdate",
				bDescending,
				aSorters = [];

			if (oBinding.aSorters.length === 0) {
				bDescending = false;
			} else {
				bDescending = !oBinding.aSorters[0].bDescending;
			}
			aSorters.push(new Sorter(sPath, bDescending));

			oBinding.sort(aSorters);

		},
		/**
		 * Función llamada al introducir un rango de fechas. Comprueba que las fechas introducidas sean correctas y después recupera
		 * los registros del empleado comprendidos entre esas fechas.
		 */
		onDateRangeChange: function () {

			var datePicker = this.getView().byId("datePicker"),
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				initDate,
				endDate,
				oModelData = this.oModel.getData(),
				todayDate = new Date(),
				today = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 12, 0, 0),
				firstShowDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), (todayDate.getDate() - parseFloat(oModelData.parameters[
					"DAS-workdayNumberShow"].value)), 12, 0, 0),
				msg = i18n.getText("msgInvalidDateRange");

			/*INI LZ 20200121 - isValidValue no está bien codificado
			Cuando seleccionas en el rango la fecha menor y cambias de vista, al volver, el 
			method devuelve falso aún siendo un rango válido*/
			if (datePicker.isValidValue()) {
				endDate = datePicker.getTo();
				if (endDate === null) {
					endDate = today;
				}
				initDate = datePicker.getFrom();
				if (initDate === null) {
					initDate = firstShowDate;
				}
				this.getAllEmployeeRecords(initDate, endDate);
			} else {
				/*Se añade esta verificación porque isValidValue hay veces que falla
				No se puede poner esta condición como principal, porque al entrar en 
				la app el datePicker no tiene valores y da problemas*/
				if (datePicker.getDateValue() > datePicker.getMaxDate() && datePicker.getSecondDateValue() < datePicker.getMinDate()) {
					utils.showErrorMessage(msg);
				}
			}

		},
		/** 
		 * Función llamada por los intervalos de tiempo cada segundo. Dependiendo del estado, actualiza los valores de tiempo
		 * trabajado o descansado y actualiza el modelo para reflejar los cambios.
		 */
		timeCount: function () {
			var oModelData = this.oModel.getData(),
				totalWorkSeconds = oModelData.totalWorkTime,
				totalRestSeconds = oModelData.totalRestTime,
				today = new Date(),
				workHours,
				workMinutes,
				workSeconds,
				restHours,
				restMinutes,
				restSeconds,
				that = this;

			if (oModelData.parameters["DAS-stopwatchMode"] && oModelData.parameters["DAS-stopwatchMode"].value === "Clock") {

				oModelData.controlVariables.mainStopwatchHours = utils.stopwatchComponentFormat(today.getHours());
				oModelData.controlVariables.mainStopwatchMinutes = utils.stopwatchComponentFormat(today.getMinutes());
				oModelData.controlVariables.mainStopwatchSeconds = utils.stopwatchComponentFormat(today.getSeconds());

			} else {
				if (oModelData.controlVariables !== undefined) {
					if (oModelData.state === constants.workDayState.working) {
						totalWorkSeconds++;
						workHours = Math.floor(totalWorkSeconds / 60 / 60);
						workMinutes = Math.floor(totalWorkSeconds / 60 % 60);
						workSeconds = Math.floor(totalWorkSeconds % 60);

						oModelData.controlVariables.mainStopwatchHours = utils.stopwatchComponentFormat(workHours);
						oModelData.controlVariables.mainStopwatchMinutes = utils.stopwatchComponentFormat(workMinutes);
						oModelData.controlVariables.mainStopwatchSeconds = utils.stopwatchComponentFormat(workSeconds);

					}

					if (oModelData.state === constants.workDayState.resting) {
						totalRestSeconds++;
						restHours = Math.floor(totalRestSeconds / 60 / 60);
						restMinutes = Math.floor(totalRestSeconds / 60 % 60);
						restSeconds = Math.floor(totalRestSeconds % 60);

						oModelData.controlVariables.secondaryStopwatchHours = utils.stopwatchComponentFormat(restHours);
						oModelData.controlVariables.secondaryStopwatchMinutes = utils.stopwatchComponentFormat(restMinutes);
						oModelData.controlVariables.secondaryStopwatchSeconds = utils.stopwatchComponentFormat(restSeconds);

					}
				}
			}

			if (oModelData.todayRecord.hasOwnProperty("limitLock") && oModelData.state !== constants.workDayState.afterWorkDay) {
				if (oModelData.todayRecord.limitLock > today.getTime()) {
					this.getView().byId("workDayBtn").setEnabled(false);
				} else {
					this.getView().byId("workDayBtn").setEnabled(true);
				}
			} else {
				//Comprobamos la lógica de roles si el estado no es jornada finalizada

				if (oModelData.state !== constants.workDayState.afterWorkDay) {
					if (oModelData.parameters["GEN-enabledRoles"].visible) {
						this.checkVentanaHorariaRol(that);
						// 		var modelUsuario = that.getView().oModels["userData"].getData();
						// 		if (modelUsuario.roles) {
						// 			var rol = modelUsuario.roles["ROL-entradaRestrVent"];
						// 			if (rol.activemp === 'X' && rol.activerol === 'X') {
						// 				var initTimeHour = parseInt(rol.inittime.split('T')[1].split(':')[0], 10),
						// 					initTimeMinutes = parseInt(rol.inittime.split('T')[1].split(':')[1], 10),
						// 					endTimeHour = parseInt(rol.endtime.split('T')[1].split(':')[0], 10),
						// 					endTimeMinutes = parseInt(rol.endtime.split('T')[1].split(':')[1], 10),
						// 					initTime = initTimeHour * 60 + initTimeMinutes,
						// 					endTime = endTimeHour * 60 + endTimeMinutes;

						// 				var currentHour = new Date().getHours(),
						// 					currentMinutes = new Date().getMinutes(),
						// 					currentTime = currentHour * 60 + currentMinutes;

						// 				if ((initTime <= currentTime) && (currentTime <= endTime)) {
						// 					this.getView().byId("workDayBtn").setEnabled(true);
						// 				} else {
						// 					this.getView().byId("workDayBtn").setEnabled(false);
						// 				}
						// 			}
						// 		}
					}
				}
			}
			this.getView().byId("contentBox").getModel().updateBindings(true);

		},
		/**
		 * Función que nos devuelve a la pantalla de login, limpiando los intervalos, modelos de datos y
		 * cookies necesarios para cerrar la sesión en el proceso.
		 */
		onPressBack: function () {
			var oModelData = this.oModel.getData();

			clearInterval(oModelData.timeInterval);
			oModelData.timeInterval = null;

			this.getOwnerComponent().getModel("companyParameters").destroy();
			sap.ui.getCore().getModel("userSessions").destroy();
			this.oModel.destroy();

			constants.timeouts.dashboard = 1500;
			constants.timeouts.schedule = 1000;

			this.oRouter.navTo("login");
		},
		/** 
		 * Función que abre un popup con la política de seguridad. Se muestra al principio de la app
		 * pero solo en caso de que no se haya aceptado la política anteriormente.
		 */
		openDialogSecurityPol: function () {
			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				that = this,
				dialog,
				securityText = '';

			if (that.oModel.getData().customText.SECURITYPOLICY.value) {
				securityText = that.oModel.getData().customText.SECURITYPOLICY.value;
			} else {
				securityText = i18n.getText("txtPruebaLoremIp");
			}

			var text = new sap.m.Text({
				text: securityText
			});

			that.dialog = dialog;
			var successBtn = new sap.m.Button({
				id: "btnAcceptScroll",
				text: i18n.getText("actAccept"),
				enabled: true,
				press: function () {
					that.acceptDialogSecurityPol(that.dialog);
				}
			}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton");
			var checkbox = new sap.m.CheckBox({
				id: i18n.getText("checkboxSecurity"),
				text: i18n.getText("lblCheckboxSecurity"),
				select: function () {
					if (document.getElementById("checkboxSecurity") !== null) {
						if (this.getSelected() === true) {
							successBtn.setEnabled(true);
						} else {
							successBtn.setEnabled(false);
						}
					}
				}
			});
			utils.popUpSecurityPolicy(that, i18n, text, checkbox, successBtn);
		},
		/**
		 * Función para el botón de aceptar del popup de seguridad. Guarda en bbdd la información
		 * y cierra el popup.
		 * @param {Object} dialog Objeto dialogo que queremos tratar
		 */
		acceptDialogSecurityPol: function (dialog) {
			var that = this,
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				urlPostCheckSP = constants.api.urlUpdateSecurityPolicy,
				postData = {},
				todayDate = new Date();

			todayDate.setHours(12, 0, 0);

			postData.checkedsecuritypolicy = todayDate;
			postData.idemployee = sap.ui.getCore().getModel("userSessions").getData().idemployee;
			postData.startdate = sap.ui.getCore().getModel("userSessions").getData().startdate;
			postData.idcompany = sap.ui.getCore().getModel("userSessions").getData().idcompany;
			postData.idoffice = sap.ui.getCore().getModel("userSessions").getData().idoffice;

			/* Modificamos los datos en el modelo actual para evitar que nos lo vuelva a checkear al hacer alguna operación
			en la misma sesión en la que hemos aceptado la política */
			sap.ui.getCore().getModel("userSessions").getData().checkedsecuritypolicy = todayDate;

			dbutils.DBPost(urlPostCheckSP, postData, i18n, function () {
				dialog.close();
			});
		},
		/**
		 * Verifica si el usuario tiene algún rol de ventana horaria activo. Para bloquearle el 
		 * botón en caso de que no pueda realizar el fichaje
		 */
		checkVentanaHorariaRol: function (that) {
			var modelUsuario = that.getView().oModels["userData"].getData();
			if (modelUsuario.roles) {
				var rol = modelUsuario.roles["ROL-entradaRestrVent"];
				if (rol.activemp === 'X' && rol.activerol === 'X') {
					var initTimeHour = parseInt(rol.inittime.split('T')[1].split(':')[0], 10),
						initTimeMinutes = parseInt(rol.inittime.split('T')[1].split(':')[1], 10),
						endTimeHour = parseInt(rol.endtime.split('T')[1].split(':')[0], 10),
						endTimeMinutes = parseInt(rol.endtime.split('T')[1].split(':')[1], 10),
						initTime = initTimeHour * 60 + initTimeMinutes,
						endTime = endTimeHour * 60 + endTimeMinutes;

					var currentHour = new Date().getHours(),
						currentMinutes = new Date().getMinutes(),
						currentTime = currentHour * 60 + currentMinutes;

					if ((initTime <= currentTime) && (currentTime <= endTime)) {
						this.getView().byId("workDayBtn").setEnabled(true);
					} else {
						this.getView().byId("workDayBtn").setEnabled(false);
					}
				}
			}
		},

		onPressTerms: function () {
			window.open("./documents/LegislacionRegistroHorario.pdf");
		},

		downloadCSV: function () {
			var that = this,
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				initDate = new sap.m.DatePicker({
					id: "initialDate",
					placeholder: i18n.getText("lblIntroduzcaFecha")
				}).addStyleClass("pdg10px"),
				endDate = new sap.m.DatePicker({
					id: "endDate",
					placeholder: i18n.getText("lblIntroduzcaFecha")
				}).addStyleClass("pdg10px");

			this.pressDialog = new sap.m.Dialog({
				title: i18n.getText("ttlGuardarComoCSV"),
				id: "csvGenerator",
				content: [
					new sap.m.VBox("csvDialogAlign", {
						alignItems: sap.m.FlexAlignItems.Center,
						items: [
							new sap.m.HBox({
								alignItems: sap.m.FlexAlignItems.Center,
								justifyContent: sap.m.FlexJustifyContent.SpaceBetween,
								items: [
									new sap.m.Label({
										text: i18n.getText("txtFechaInicial"),
										labelFor: "initialDate"
									}).addStyleClass("width100"),
									initDate
								],
							}),
							new sap.m.HBox({
								alignItems: sap.m.FlexAlignItems.Center,
								justifyContent: sap.m.FlexJustifyContent.SpaceBetween,
								items: [
									new sap.m.Label({
										text: i18n.getText("txtFechaFinal"),
										labelFor: "endDate"
									}).addStyleClass("width100"),
									endDate
								]
							})
						]
					})
				],

				//Comienza la descarga del CSV desde el back
				endButton: new sap.m.Button({
					text: i18n.getText("txtGenerarCSV"),
					press: function (evt) {
						var recordData = sap.ui.getCore().getModel("userSessions").getData(),
							initialDate = initDate.mProperties.dateValue,
							endingDate = endDate.mProperties.dateValue,
							verification = utils.verifyDateRange(initialDate, endingDate, i18n),
							startdate = utils.stringifyDate(new Date(recordData.startdate), 2),
							recordinitdate = utils.stringifyDate(initialDate, 2),
							recordenddate = utils.stringifyDate(endingDate, 2);

						if (!verification.error) {
							dbutils.DBPostCSV(constants.api.urlGenerateCSVEmployee, {
								idemployee: recordData.idemployee,
								startdate: startdate,
								recordinitdate: recordinitdate,
								recordenddate: recordenddate
							}, that.getView().getModel("i18n").getResourceBundle(), function (response) {
								var sFileContent = "\uFEFF" + response;
								var sFileName = 'allrecords_employee' + '_' + recordinitdate + '-' + recordenddate + new Date().toISOString();
								var sFileType = "csv";
								File.save(sFileContent, sFileName, sFileType, null, null);
							});
						} else {
							sap.m.MessageToast.show(verification.error_info, {
								duration: 4000
							});
						}
					}
				}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton"),
				beginButton: new sap.m.Button({
					text: i18n.getText("btnCerrar"),
					press: function () {
						that.pressDialog.close();
						that.pressDialog.destroy();
					}
				}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton")
			}).addStyleClass("width400");

			this.getView().addDependent(this.pressDialog);
			this.pressDialog.open();
		},
		gotoSFSF: function () {
			var thisLocation = window.location.hostname,
				QAUrl = constants.SFSF.QuaURL,
				DevURL = constants.SFSF.DevURL;

			if (thisLocation.indexOf("telefonicafichajes-s2c88f45f") !== -1) {
				window.open("https://" + DevURL + "/sf/start", "_self");
			} else if (thisLocation.indexOf("telefonicafichajes-g399b72atz") !== -1) {
				window.open("https://hcm12preview.sapsf.eu/sf/liveprofile", "_self");
			} else if (thisLocation.indexOf("telefonicafichajes-f7dl6r99zq") !== -1) {
				window.open("https://performancemanager5.successfactors.eu/sf/liveprofile", "_self");
			} else {
				window.open("https://" + DevURL + "/sf/start", +"_self");
			}
		},
		setInactivityTimer: function () {
			var that = this;

			window.addEventListener('focus', function () { //console.log('focus');
				iCountInactivity = 0;
			});

			window.addEventListener('click', function () {
				iCountInactivity = 0;
			});

			window.addEventListener('keypress', function () {
				iCountInactivity = 0;
			});
			setInterval(function () {
				that.timerIncrement(that)
			}, 1000); // ms
		},

		timerIncrement: function (that) {
			iCountInactivity = iCountInactivity + 1;
			//console.log("Seconds of inactivity: " + iCountInactivity);
			if (iCountInactivity === iInactivityInterval) {
				var i18n = that.getView().getModel("i18n").getResourceBundle();
				var test = new sap.m.Dialog({ //"informativeExcessDialog",
					title: i18n.getText("ttlTiempoInactividadSuperado"),
					content: new sap.m.VBox()
				}).addStyleClass("informativeExcessDialog");

				test.getContent()[0].addItem(new sap.m.HBox({
					items: [new sap.m.Text({
						text: i18n.getText("lblTiempoInactividad")
					})]
				}));

				test.open();
			}
		}

	});
});