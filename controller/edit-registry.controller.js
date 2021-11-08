sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"epicfichajes/epicfichajes/utils/formatter"
], function (Controller, History, JSONModel, MessageBox, formatter) {
	"use strict";

	var oController;
	var iTimeExceeded, iTotalHoursRecorded;
	var iCountInactivity = 0,
		iInactivityInterval = 400;

	return Controller.extend("epicfichajes.epicfichajes.controller.editHorario", {
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf epicfichajes.epicfichajes.view.edit-registry
		 */
		formatter: formatter,
		onInit: function () {
			oController = this;
			this.oRouter = sap.ui.core.UIComponent.getRouterFor(this); //Componente para la navegación
			this.oRouter.getRoute("edit-registry").attachPatternMatched(this.loadData, this); //Carga de parámetros

			this.setInactivityTimer();
		},
		/**
		 * Comprueba la conexión y extrae los parámetros de la llamada a la vista para crear un modelo con el que rellenar los campos del form.
		 */
		loadData: function () {

			var that = this,
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				todayDate = new Date(),
				today = utils.stringifyDate(todayDate, 1),
				oModelDetail,
				urlSCPProcedureGetRecords = constants.api.urlGetDailyRecords,
				urlSCPProcedureGetRestReasons = constants.api.urlGetRestReasons,
				language = sap.ui.getCore().getConfiguration().getLanguage(),
				postData,
				restTypePostData,
				formattedDate,
				i = 0,
				j = 0;

			this.oModelData = []; //Referencia al modelo
			this.initialData = []; //Datos iniciales para comprobar cambios

			dbutils.checkConnection(this.oRouter, i18n, this.getView().getId(), that, function () {
				that.oModelData = that.getOwnerComponent().getModel("editRegistry").getData();
				if (that.oModelData.recordinitdate !== undefined) {

					utils.loadParameters(that.oModelData, that);

					if (language.length > 2) {
						language = language.split("-")[0].toUpperCase();
					}

					restTypePostData = {
						"language": language
					};

					postData = sap.ui.getCore().getModel("userSessions").getData();

					try {
						formattedDate = that.oModelData.recordinitdate.split("/");
					} catch (e) {
						if (e instanceof TypeError) {
							that.oModelData.recordinitdate = utils.stringifyDate(that.oModelData.recordinitdate, 1);
							that.oModelData.checkgoodpractices = that.oModelData.checkgoodpractices === 1 ? true : false;
							// formattedDate = utils.stringifyDate(that.oModelData.recordinitdate, 1).split("/")
						}
					}
					formattedDate = that.oModelData.recordinitdate.split("/");
					postData.recordinitdate = new Date(formattedDate[2], parseFloat(formattedDate[1] - 1), formattedDate[0], 12, 0, 0);

					// if ( /*today === that.oModelData.recordinitdate ||*/ that.oModelData.parameters['GEN-editableToday'].value === 'false' || utils
					// 	.reverseOffset(that.oModelData.recordinittime) <= firstEditDate) { //Se comenta la verificación del día de hoy 
					// 	that.oModelData.editReg = i18n.getText("lblNoEditing"); //para poder editar registros en el mismo día
					// 	that.oModelData.editable = false;
					// } else {
					// 	that.oModelData.editReg = i18n.getText("lblEditing");
					// 	that.oModelData.editable = true;
					// }

					that.oModelData.editReg = that.oModelData.editable ? i18n.getText("lblEditing") : i18n.getText("lblNoEditing");

					that.initialData.recordinittime = that.oModelData.recordinittime;
					that.initialData.recordendtime = that.oModelData.recordendtime;
					that.initialData.totalrestingtime = that.oModelData.totalrestingtime;
					that.initialData.inittimestring = that.oModelData.inittimestring;
					that.initialData.endtimestring = that.oModelData.endtimestring;
					that.initialData.editinittime = that.oModelData.editinittime === 'X' ? true : false;
					that.initialData.editendtime = that.oModelData.editendtime === 'X' ? true : false;
					that.initialData.editrestingtime = that.oModelData.editrestingtime === 'X' ? true : false;
					that.initialData.checkgoodpractices = (that.oModelData.checkgoodpractices === 1 || that.oModelData.checkgoodpractices === true) ?
						true : false;

					that.oModelData.startdate = postData.startdate;
					that.oModelData.idemployee = postData.idemployee;

					dbutils.DBPost(urlSCPProcedureGetRecords, postData, i18n, function (data) {
						utils.treatDailyRecordsFromDatabase(data, i18n);
						dbutils.DBPost(urlSCPProcedureGetRestReasons, restTypePostData, i18n, function (restData) {
							
							for (i = 0; i < data.length; i++) {
								if (data[i].idresttype === null) {
									if (data[i].restdetail === null) {
										data[i].regIcon = constants.icons.workDayIcon;
										data[i].restdetail = i18n.getText("lblWork");
									} else {
										data[i].regIcon = constants.icons.unspecifiedIcon;
									}
								} else {
									for (j = 0; j < restData.length; j++) {
										if (restData[j].idresttype === data[i].idresttype) {
											data[i].regIcon = restData[j].icon;
											if (data[i].idresttype === 1) {
												data[i].restdetail = i18n.getText("wdsFinish");
											}
											break;
										}
									}
								}
							}

							//if (that.initialData.editinittime || that.initialData.editendtime) {
							var initDateMoment = new Date(new Date(that.initialData.recordinittime).getTime() + (new Date(that.initialData.recordinittime)
								.getTimezoneOffset() * 60 * 1000));
							var endDateMoment = new Date(new Date(that.initialData.recordendtime).getTime() + (new Date(that.initialData.recordendtime)
								.getTimezoneOffset() * 60 * 1000));

							var formatInitMoment = utils.formatToDailyRecords(initDateMoment);
							var formatEndMoment = utils.formatToDailyRecords(endDateMoment);

							data.filter(function (el) {
								return !el.idresttype;
							})[0].datetimemoment = formatInitMoment;

							try {
								data.filter(function (el) {
									return el.idresttype === 1;
								})[0].datetimemoment = formatEndMoment;
							} catch (err) {

							}

							data.sort(function (a, b) {
								var date1 = new Date(utils.voltearFecha(a.datetimemoment.split(" ")[0]) + " " + a.datetimemoment.split(" ")[1]),
									date2 = new Date(utils.voltearFecha(b.datetimemoment.split(" ")[0]) + " " + b.datetimemoment.split(" ")[1]);

								return date1 > date2;
							});

							/*	Bloquear edición de la hora fin en el día de hoy 
							 *	Si se permitirá editar registros del mismo día siempre que se hayan finalizado
							 */
							if (today === that.oModelData.recordinitdate) {
								if (that.oModelData.recordendtime !== "") {
									that.getOwnerComponent().getModel("editRegistry").oData.editingToday = false;
								} else {
									that.getOwnerComponent().getModel("editRegistry").oData.editingToday = true;
								}
							} else {
								that.getOwnerComponent().getModel("editRegistry").oData.editingToday = false;
							}
							//}

							utils.loadParameters(data, that);
							oModelDetail = new JSONModel(data);

							that.getView().byId("detailTable").setModel(oModelDetail);
							that.getOwnerComponent().getModel("editRegistry").updateBindings();
							that.getView().byId("contentBox").setModel(that.getOwnerComponent().getModel("editRegistry"));
							that.onHourChange();
							utils.loadStyle(data, that);

							
							var userData = sap.ui.getCore().getModel("userSessions").getData(),
								detailTableModel = that.getView().byId("detailTable").getModel().getData(),
								initdatePost = utils.voltearFecha(detailTableModel.filter(function (elem) {
									return elem.idresttype === null
								})[0].datetimemoment.split(" ")[0]);
							var postUserData = {
								"idemployee": userData.idemployee,
								"startdate": utils.stringifyDate(new Date(userData.startdate), 2),
								"initdate": utils.stringifyDate(new Date(initdatePost), 2),
								"enddate": utils.stringifyDate(new Date(initdatePost), 2),
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
									weekDay = new Date(initdatePost).getDay() === 0 ? 7 : new Date(initdatePost).getDay();

								
								if (noRestDays && noRestDays.indexOf(weekDay) !== -1) {
									that.oModelData.parameters["GEN-MandatoryRest"].value = "false";
								}

								if (filteredSchedule.minWorkTimeForRest == true && that.oModelData.parameters["GEN-MandatoryRest"].value == true) {
									that.oModelData.parameters['GEN-MandatoryRestTime'].value = filteredSchedule.mandatoryRestTime;
									that.oModelData.parameters['GEN-MinWorkTimeForRest'].value = filteredSchedule.minWorkTimeForRest;
								}
							})
						});
					});
				} else {
					that.oRouter.navTo("home");
				}
			});

		},
		/**
		 * Función que valida los datos editados. 
		 */
		onHourChange: function () {
			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				entryHourPicker = this.getView().byId("entryHourPicker"),
				exitHourPicker = this.getView().byId("exitHourPicker"),
				restInput = this.getView().byId("restInput"),
				workInput = this.getView().byId("workInput"),
				saveBtn = this.getView().byId("saveBtn"),
				editingToday = this.oModelData.editingToday;

			//Hora de inicio de jornada sin rellenar
			if (entryHourPicker.getDateValue() === null) {
				entryHourPicker.setValueState("Error");
				entryHourPicker.setValueStateText(i18n.getText("msgRequiredEntryTime")); //Hora de entrada vacía
				workInput.setValue("");
			} else {
				entryHourPicker.setValueState("None");
			}
			//Hora de fin de jornada sin rellenar
			if (exitHourPicker.getDateValue() === null) {
				exitHourPicker.setValueState("Error");
				exitHourPicker.setValueStateText(i18n.getText("msgRequiredExitTime")); //Hora de salida vacía
				workInput.setValue("");

				if (new Date(utils.voltearFecha(this.oModelData.recordinitdate)).getDate() === new Date().getDate() && new Date(utils.voltearFecha(
						this.oModelData.recordinitdate)).getMonth() === new Date().getMonth()) {
					if (entryHourPicker.getDateValue().getHours() > new Date().getHours() && entryHourPicker.getDateValue().getMinutes() > new Date()
						.getMinutes()) {
						entryHourPicker.setValueState("Error");
						entryHourPicker.setValueStateText(i18n.getText("msgTodayHourNotAfter"));
					} else if (entryHourPicker.getDateValue().getHours() > new Date().getHours()) {
						entryHourPicker.setValueState("Error");
						entryHourPicker.setValueStateText(i18n.getText("msgTodayHourNotAfter"));
					} else if (entryHourPicker.getDateValue().getHours() === new Date().getHours() && entryHourPicker.getDateValue().getMinutes() >
						new Date()
						.getMinutes()) {
						entryHourPicker.setValueState("Error");
						entryHourPicker.setValueStateText(i18n.getText("msgTodayHourNotAfter"));
					} else {
						entryHourPicker.setValueState("None");
					}
				} else {
					entryHourPicker.setValueState("None");
				}
			} else {
				exitHourPicker.setValueState("None");
			}
			//Ambas horas rellenas
			if (entryHourPicker.getDateValue() !== null && exitHourPicker.getDateValue() !== null) {
				//Hora entrada mayor que hora salida 
				if (exitHourPicker.getDateValue() <= entryHourPicker.getDateValue()) {
					entryHourPicker.setValueState("Warning");
					entryHourPicker.setValueStateText(i18n.getText("msgNighttimeWorkingDay"));
					exitHourPicker.setValueState("Warning");
					exitHourPicker.setValueStateText(i18n.getText("msgNighttimeWorkingDay"));

					workInput.setValue("");
				} else {
					entryHourPicker.setValueState("Success");
					exitHourPicker.setValueState("Success");
				}
				//Tiempo de descanso positivo - datos validados
				/*if (restInput.getValue() >= 0) {
					restInput.setValueState("Success");
					this.setWorkTime(this.getView().byId("entryHourPicker").getDateValue(), this.getView().byId("exitHourPicker").getDateValue(),
						restInput.getValue() * 60);
				}
				//Tiempo de descanso negativo
				else {
					restInput.setValueState("Error");
					restInput.setValueStateText(i18n.getText("msgWrongRestTime"));
					workInput.setValue("");
				}*/

				if (new Date(utils.voltearFecha(this.oModelData.recordinitdate)).getDate() === new Date().getDate() && new Date(utils.voltearFecha(
						this.oModelData.recordinitdate)).getMonth() === new Date().getMonth()) {
					if (exitHourPicker.getDateValue().getHours() > new Date().getHours() && exitHourPicker.getDateValue().getMinutes() > new Date().getMinutes()) {
						exitHourPicker.setValueState("Error");
						exitHourPicker.setValueStateText(i18n.getText("msgTodayHourNotAfter"));
					} else if (exitHourPicker.getDateValue().getHours() > new Date().getHours()) {
						exitHourPicker.setValueState("Error");
						exitHourPicker.setValueStateText(i18n.getText("msgTodayHourNotAfter"));
					} else if (exitHourPicker.getDateValue().getHours() === new Date().getHours() && exitHourPicker.getDateValue().getMinutes() > new Date()
						.getMinutes()) {
						exitHourPicker.setValueState("Error");
						exitHourPicker.setValueStateText(i18n.getText("msgTodayHourNotAfter"));
					} else {
						exitHourPicker.setValueState("None");
					}
				} else if (exitHourPicker.getValueState() !== "Warning") {
					exitHourPicker.setValueState("None");
				}

				if (new Date(utils.voltearFecha(this.oModelData.recordinitdate)).getDate() === new Date().getDate() && new Date(utils.voltearFecha(
						this.oModelData.recordinitdate)).getMonth() === new Date().getMonth()) {
					if (entryHourPicker.getDateValue().getHours() > new Date().getHours() && entryHourPicker.getDateValue().getMinutes() > new Date()
						.getMinutes()) {
						entryHourPicker.setValueState("Error");
						entryHourPicker.setValueStateText(i18n.getText("msgTodayHourNotAfter"));
					} else if (entryHourPicker.getDateValue().getHours() > new Date().getHours()) {
						entryHourPicker.setValueState("Error");
						entryHourPicker.setValueStateText(i18n.getText("msgTodayHourNotAfter"));
					} else if (entryHourPicker.getDateValue().getHours() === new Date().getHours() && entryHourPicker.getDateValue().getMinutes() >
						new Date()
						.getMinutes()) {
						entryHourPicker.setValueState("Error");
						entryHourPicker.setValueStateText(i18n.getText("msgTodayHourNotAfter"));
					} else {
						entryHourPicker.setValueState("None");
					}
				} else if (entryHourPicker.getValueState() !== "Warning") {
					entryHourPicker.setValueState("None");
				}

				var initTime = parseInt(this.byId("entryHourPicker").getValue().split(":")[0]) + parseInt(this.byId("entryHourPicker").getValue().split(
						":")[1]) / 60,
					exitTime = parseInt(this.byId("exitHourPicker").getValue().split(":")[0]) + parseInt(this.byId("exitHourPicker").getValue().split(
						":")[1]) / 60;

				if (initTime > exitTime &&
					new Date(utils.voltearFecha(this.oModelData.recordinitdate)).getDate() === new Date().getDate() &&
					new Date(utils.voltearFecha(this.oModelData.recordinitdate)).getMonth() === new Date().getMonth() &&
					new Date(utils.voltearFecha(this.oModelData.recordinitdate)).getDate() === new Date().getDate() &&
					new Date(utils.voltearFecha(this.oModelData.recordinitdate)).getMonth() === new Date().getMonth()) {
					entryHourPicker.setValueState("Error");
					entryHourPicker.setValueStateText(i18n.getText("msgTodayHourNotAfter"));
					exitHourPicker.setValueState("Error");
					exitHourPicker.setValueStateText(i18n.getText("msgTodayHourNotAfter"));
				}
			}

			if (!exitHourPicker.getEnabled()) {
				exitHourPicker.setValueState("None");
			}

			var editadoInicio = true;
			if (this.initialData.inittimestring && this.oModelData.inittimestring) {
				if (this.initialData.inittimestring.substr(0, 5) === this.oModelData.inittimestring.substr(0, 5)) {
					editadoInicio = false;
				}
			} else {
				editadoInicio = false;
			}

			var editadoFin = true;
			if (this.initialData.endtimestring && this.oModelData.endtimestring && this.initialData.totalrestingtime) {
				if (this.initialData.endtimestring.substr(0, 5) === this.oModelData.endtimestring.substr(0, 5) && this.initialData.totalrestingtime
					.toString() === restInput.getValue()) {
					editadoFin = false;
				}
			} else {
				editadoFin = false;
			}

			var editadoDescansos = false;
			if (this.oModelData.parameters["GEN-workdayHasRests"].value === "true") {
				if (restInput.getValueState() === "Error" && restInput.getVisible()) {
					editadoDescansos = false;
				} else {
					editadoDescansos = true;
				}
			} else {
				editadoDescansos = false;
			}

			var enableButton = false;

			//Comprobamos si se ha editado algo para habilitar o no el botón
			if ((editadoInicio || editadoFin || editadoDescansos) && entryHourPicker.getValueState() !== 'Error') {
				if (editingToday || (entryHourPicker.getValueState() !== 'Error' && exitHourPicker.getValueState() !== 'Error')) {
					enableButton = true; //true
				} else {
					enableButton = false; //false
				}
			} else {
				enableButton = false; //false
			}

			// JBV - Modificación para bloqueo de registros si verificación es errónea
			if ((entryHourPicker.getValueState() !== 'Error' && exitHourPicker.getValueState() !== 'Error')) {
				enableButton = true;
			} else {
				enableButton = false;
			}
			// JBV - Fin modificación para bloqueo de registros

			saveBtn.setEnabled(enableButton);
			this.oModelData.correctData = enableButton;
		},
		/**
		 * Función de cálculo de tiempo trabajado. 
		 * @param {string} entryHour: hora de entrada de la jornada.
		 * @param {string} exitHour: hora de salida de la jornada.
		 * @param {string} restMinutes: minutes descansados en la jornada.
		 */
		setWorkTime: function (entryHour, exitHour, restSeconds) {

			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				seconds,
				hours,
				minutes,
				nightDate,
				workInput = this.getView().byId("workInput"),
				restInput = this.getView().byId("restInput");

			seconds = (exitHour - entryHour) / 1000;
			if (seconds < 0) {
				nightDate = new Date(exitHour.getFullYear(), exitHour.getMonth(), exitHour.getDate() + 1, exitHour.getHours(), exitHour.getMinutes(),
					exitHour.getSeconds());
				seconds = (nightDate - entryHour) / 1000;
			}

			if (restSeconds !== "" && restSeconds !== null && restSeconds !== undefined) {
				seconds = (seconds - restSeconds);
			}
			hours = Math.floor(seconds / 60 / 60);
			minutes = Math.floor(seconds / 60 % 60);

			//Tiempo de trabajo > 0 - datos correctos
			if ((hours === 0 && minutes > 0) || (hours > 0 && minutes >= 0)) {
				workInput.setValue(utils.secondsToHoursAndMinutes(seconds, i18n));
				//workInput.setValue(params.postData.totalrestingtime);//MERY
				this.oModelData.correctData = true;
				//Tiempo de trabajo <= 0 - datos erróneos
			} else {
				workInput.setValue("");
				this.oModelData.correctData = false;
				restInput.setValueState("Error");
				restInput.setValueStateText(i18n.getText("msgWrongRestTime"));
			}

		},
		/** 
		 * Botón Guardar Cambios pulsado. Llama al diálogo de confirmación que permite recoger todos los datos y enviarlos 
		 * a la BBDD para actualizar el registro correspondiente si se pulsa el botón de aceptar. 
		 */
		onPressConfirm: function () {

			var that = this,
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				modData = this.getView().byId("contentBox").getModel().getData(),
				urlSCPProcedure = constants.api.urlPostRecord,
				postData = this.getOwnerComponent().getModel("editRegistry").getData(),
				formattedDate /*= modData.recordinitdate.split("/")*/ ,
				restTime = (modData.totalrestingtime * 60),
				params,
				inittime = modData.inittimestring.split(":"),
				entryHourPicker = this.getView().byId("entryHourPicker"),
				exitHourPicker = this.getView().byId("exitHourPicker"),
				today = new Date(),
				initTime = parseInt(this.byId("entryHourPicker").getValue().split(":")[0]) + parseInt(this.byId("entryHourPicker").getValue().split(
					":")[1]) / 60,
				exitTime = parseInt(this.byId("exitHourPicker").getValue().split(":")[0]) + parseInt(this.byId("exitHourPicker").getValue().split(
					":")[1]) / 60,
				workedTime;

			if (initTime < exitTime) {
				workedTime = (exitTime - initTime) - restTime;
			} else {
				workedTime = (exitTime + (24 - initTime)) - restTime;
			}

			var endtime = [];
			try {
				endtime = modData.endtimestring.split(":");
			} catch (e) {
				console.log(e);
			}
			today.setHours(12, 0, 0, 0);

			try {
				formattedDate = modData.recordinitdate.split("/");
			} catch (e) {
				if (e instanceof TypeError) {
					formattedDate = utils.stringifyDate(modData.recordinitdate, 1).split("/");
				}
			}

			if (this.oModelData.correctData === true) {

				postData.recordinitdate = new Date(formattedDate[2], parseFloat(formattedDate[1] - 1), formattedDate[0], 12, 0, 0);
				postData.recordinittime = utils.getOffset(new Date(formattedDate[2], parseFloat(formattedDate[1] - 1), formattedDate[0],
					inittime[
						0], inittime[1], 0));
				if (entryHourPicker.getValueState() === "Warning" || exitHourPicker.getValueState() === "Warning") {
					postData.recordenddate = new Date(formattedDate[2], parseFloat(formattedDate[1] - 1), parseFloat(formattedDate[0]) + 1, 12, 0,
						0);
					postData.recordendtime = utils.getOffset(new Date(formattedDate[2], parseFloat(formattedDate[1] - 1), parseFloat(formattedDate[
							0]) +
						1, endtime[0], endtime[1], 0));
				} else {
					postData.recordenddate = new Date(formattedDate[2], parseFloat(formattedDate[1] - 1), formattedDate[0], 12, 0, 0);
					postData.recordendtime = utils.getOffset(new Date(formattedDate[2], parseFloat(formattedDate[1] - 1), formattedDate[0], endtime[
							0],
						endtime[1], 0));
				}
				//postData.idstatus = constants.workDayState.resting;
				if (today.getTime() === postData.recordinitdate.getTime()) {
					postData.idstatus = this.oModelData.state;
					// postData.recordenddate = null;
					// postData.recordendtime = null;
					// postData.recordenddate = this.oModelData.recordenddate;
					// postData.recordendtime = this.oModelData.recordendtime;
					postData.editingToday = true;
				} else {
					postData.idstatus = constants.workDayState.afterWorkDay;
				}
				postData.idregtype = constants.regType.edited;
				postData.totalworkingtime = workedTime;
				postData.totalrestingtime = restTime;

				if ((postData.totalworkingtime ? postData.totalworkingtime : 0) < this.oModelData.parameters["GEN-MinWorkTimeForRest"].value &&
					this.oModelData.parameters["GEN-MandatoryRest"].value.toUpperCase() === "TRUE") {
					postData.totalrestingtime = 0;
					postData.totalworkingtime = restTime + workedTime;
				} else if (this.oModelData.parameters["GEN-MandatoryRest"].value.toUpperCase() === "TRUE") {
					postData.totalrestingtime = parseInt(this.oModelData.parameters["GEN-MandatoryRestTime"].value);
				}

				postData.invalidRecord = "";
				postData.offset = utils.getOffset(today);
				postData.editing = true; //Variable para controlar en el back si se está editando o no

				if (this.oModelData.editinittime === "X") {
					postData.editinittime = this.oModelData.editinittime;
				} else {
					postData.editinittime = this.initialData.inittimestring === modData.inittimestring ? "" : "X";
				}

				if (this.oModelData.editendtime === "X") {
					postData.editendtime = this.oModelData.editendtime;
				} else {
					postData.editendtime = this.initialData.endtimestring === modData.endtimestring ? "" : "X";
				}

				if (this.oModelData.editrestingtime === "X") {
					postData.editrestingtime = this.oModelData.editrestingtime;
				} else {
					postData.editrestingtime = this.initialData.totalrestingtime === modData.totalrestingtime ? "" : "X";
				}

				postData.checkgoodpractices = this.oModelData.checkgoodpractices === true ? 1 : 0;
				postData.checkextrahours = this.oModelData.checkextrahours === true ? 1 : 0;

				params = {
					title: i18n.getText("ttlSaveChanges"),
					text: i18n.getText("msgSaveChanges"),
					order: "editWorkDaySave",
					postData: postData,
					url: urlSCPProcedure,
					successBtn: i18n.getText("actYes"),
					exitBtn: i18n.getText("actNo")
				};

				// if (this.oModelData.parameters["GEN-MandatoryRest"].value.toUpperCase() === "TRUE") {
				// 	if (this.oModelData.totalworkingtime > this.oModelData.parameters["GEN-MinWorkTimeForRest"].value) {
				// 		this.oModelData.totalworkingtime = (this.oModelData.totalworkingtime - this.oModelData.parameters["GEN-MandatoryRestTime"].value);
				// 	}
				// }

				if (!this.oModelData.controlVariables) {
					this.oModelData.controlVariables = {};
					this.oModelData.controlVariables.plannedLunchMinutes = this.oModelData.parameters["GEN-MinWorkTimeForRest"].value / 60;
					this.oModelData.plannedMinutes = this.oModelData.controlVariables.plannedMinutes;
				}

				iTotalHoursRecorded = workedTime + restTime;
				//iTotalHoursRecorded = (this.oModelData.recordendtime - this.oModelData.recordinittime)/3600000;
				
				
				/*INI - 21/10/2020 - TGTJORN-55 - @jgalaber - Obtiene la información de la semana, y recupera el valor de las horas planificadas, para el día de la semana*/
				
				var that = this;
				var urlWorkschedule = "/workschedules/getWorkScheduleEmployeeByDate.xsjs",
					postData		= {
						idemployee: that.oModelData.idemployee,
						startdate:	that.oModelData.startdate,
						initdate:	utils.stringifyDate(that.oModelData.recordinitdate, 2),
						enddate:	utils.stringifyDate(that.oModelData.recordenddate, 2),
						lng:		sap.ui.getCore().getConfiguration().getLanguage().substr(3,4)
					};
				
				dbutils.DBPost(urlWorkschedule, postData, i18n, function (data) {
					var plannedhours	= 0,
						initdateNumday	= new Date(postData.initdate).getDay();
					
					if (data.length > 0) {
						if( initdateNumday == 0 ) {
							plannedhours = data.filter( function (elem) { return elem.numday === 7 ;} )[0].plannedhours;
						} else {
							plannedhours = data.filter( function (elem) { return elem.numday === initdateNumday ;} )[0].plannedhours;
						}
					} 
					/*
						--- Codigo aniguo ---
							var iMinHoursDay  = parseFloat(this.getView().getModel("oModelReducedSchedule").getData().plannedHours);
						--- Codigo aniguo ---
					*/
					var iMinHoursDay = parseFloat(plannedhours);
					
					if (that.getView().getModel("oModelReducedSchedule").getData().reducedworkingday && that.oModelData.parameters["GEN-MandatoryRest"]
					.value.toUpperCase() === "TRUE") {
					if (iTotalHoursRecorded * 3600 >= constants.reducedScheduleMandTime) {
						iMinHoursDay += that.oModelData.parameters["GEN-MandatoryRestTime"].value / 3600;
						params.postData.totalrestingtime = parseInt(that.oModelData.parameters["GEN-MandatoryRestTime"].value);
					}
					} else if (that.oModelData.parameters["GEN-MandatoryRest"].value.toUpperCase() === "TRUE" && (iTotalHoursRecorded * 3600 > that
							.oModelData.parameters["GEN-MinWorkTimeForRest"].value)) {
						//Si supera las horas maximas de trabajo le restamos el tiempo de comida
						iMinHoursDay += that.oModelData.parameters["GEN-MandatoryRestTime"].value / 3600;
						params.postData.totalrestingtime = parseInt(that.oModelData.parameters["GEN-MandatoryRestTime"].value);
					}
	
					if ((exitTime > 21 || initTime > 21) && that.oModelData.parameters["GEN-NONPOPEXCEEDED"].value === "true") {
						that.showInformativePopup(i18n.getText("lblAttention"), i18n.getText("msgTlfWkndPolicy"), true);
					}
	
					if (iTotalHoursRecorded > (iMinHoursDay + (constants.iMinExcessMargin / 60)) && that.oModelData.idstatus === 4
						/*&& new Date().getHours() <
						21*/
					) {

						params.plannedhours = plannedhours;
						that.showExcessPopup(that, params, History);
					} else {
						if (that.getView().getModel("oModelReducedSchedule").getData().reducedworkingday) {
							if (iTotalHoursRecorded * 3600 < constants.reducedScheduleMandTime) {
								params.postData.totalrestingtime = 0;
							}
						}
	
						if (that.oModelData.parameters["GEN-MandatoryRest"].value.toUpperCase() === "FALSE") {
							params.postData.totalworkingtime = (iTotalHoursRecorded * 3600);
							params.postData.totalrestingtime = 0;
						} else {
							params.postData.totalworkingtime = (iTotalHoursRecorded * 3600) - (params.postData.totalrestingtime);
						}
	
						params.postData.totalexcesstime = 0;
	
						utils.confirmDialog(that, i18n, params, History);
					}
				});
				
				/*FIN - 21/10/2020 - TGTJORN-55 - @jgalaber - Obtiene la información de la semana, y recupera el valor de las horas planificadas, para el día de la semana*/
			}	
		},

		/*
		 *Función del pop up de exceso en el modo edición
		 */
		showExcessPopup: function (that, params, history) {

			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				oModel = that.oModelData,
				//hourCalc = that.oModelData.totalWorkTime / 3600 - that.getView().getModel("oModelReducedSchedule").getData().plannedHours;
				hourCalc = iTotalHoursRecorded - (params.plannedhours !== undefined && params.plannedhours !== null ? params.plannedhours : parseFloat(that.getView().getModel("oModelReducedSchedule").getData().plannedHours));
			//- parseInt(oModel.parameters["GEN-MandatoryRestTime"].value) / 3600;

			// hourCalc = hourCalc = parseInt(hourCalc) + parseInt((hourCalc - parseInt(hourCalc)) * 60)/60;

			if (that.getView().getModel("oModelReducedSchedule").getData().reducedworkingday && oModel.parameters["GEN-MandatoryRest"].value.toUpperCase() ===
				"TRUE") {
				if (iTotalHoursRecorded * 3600 >= constants.reducedScheduleMandTime) {
					hourCalc = hourCalc - oModel.parameters["GEN-MandatoryRestTime"].value / 3600;
				}
			} else if (oModel.parameters["GEN-MandatoryRest"].value.toUpperCase() === "TRUE" && (iTotalHoursRecorded > parseInt(oModel.parameters[
					"GEN-MinWorkTimeForRest"].value) / 3600)) {
				//Si supera las horas maximas de trabajo le restamos el tiempo de comida
				hourCalc = hourCalc - oModel.parameters["GEN-MandatoryRestTime"].value / 3600;
			}

			iTimeExceeded = hourCalc;
			var displayedTime = utils.clockFormat(hourCalc);
			//Declaración de elementos que se van a utilizar en el dialog.
			var excessDialog = new sap.m.Dialog("excessDialog", {
				title: "Recordatorio exceso de Jornada",
				content: new sap.m.VBox(),
				escapeHandler: function () {
					return false;
				},
				buttons: [
					new sap.m.Button({
						text: i18n.getText("btnCancelar"),
						press: function () {
							excessDialog.close();
							excessDialog.destroy();
						}
					}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton"),
					new sap.m.Button({
						text: i18n.getText("btnAceptar"),
						press: function () {
							var schedule = that.getView().getModel("oModelReducedSchedule").getData();
							var checkboxPersonalValue = sap.ui.getCore().byId("motivosPersonales").getSelected(),
								checkboxWorkingValue = sap.ui.getCore().byId("motivosLaborales").getSelected(),
								checkboxNotExceedValue = sap.ui.getCore().byId("jornadaNoExcedida").getSelected(),
								iSecsCalc = Math.floor(iTimeExceeded * 3600);
							
							var personalTimeValue = checkboxPersonalValue ? parseInt(sap.ui.getCore().byId("pickerPersonalTime").getValue().split(":")[
									0]) * 3600 + parseInt(sap.ui.getCore().byId("pickerPersonalTime").getValue().split(":")[1]) * 60 : null,
								workingTimeValue = checkboxWorkingValue ? parseInt(sap.ui.getCore().byId("pickerWorkingTime").getValue().split(":")[0]) *
								3600 + parseInt(sap.ui.getCore().byId("pickerWorkingTime").getValue().split(":")[1]) * 60 : null;

							setTimeout(function () {
								/*INI - 30/09/2020 - Cuando se selecciona el check de no ha excedido la jornada no se debe mantener las horas como extras - @jgalaber */
								/*
									Se ha cambiado la posición del else if '} else if (checkboxNotExceedValue) { '
										Por relevancia prioritaria frente a los demás.
								*/
								if (that.checkPopUpErrorMessages()) {
									if (!checkboxPersonalValue && !checkboxWorkingValue && !checkboxNotExceedValue) { //MERY error detectado
										//sap.m.MessageToast.show(i18n.getText("txtNoCheckboxSelected"), { duration: 10000 });
										sap.ui.getCore().byId("mstrpNoCheckboxSelected").setVisible(true);
									/* Se comprueba su casúistica antes y con eso se consigue que no se la salte */
									} else if (checkboxNotExceedValue) { //si está a true, se mandan las horas de jornada normal ya que ha sido un olvido el motivo de fichar tan tarde
										var iAddTime = parseFloat(schedule.plannedHours);
										if (that.getView().getModel("oModelReducedSchedule").getData().reducedworkingday && oModel.parameters[
												"GEN-MandatoryRest"].value.toUpperCase() === "TRUE") {
											if (iTotalHoursRecorded * 3600 >= constants.reducedScheduleMandTime) {
												iAddTime += parseFloat(oModel.parameters["GEN-MandatoryRestTime"].value / 3600);
												params.postData.totalrestingtime = parseInt(parseFloat(oModel.parameters["GEN-MandatoryRestTime"].value));
											}
										} else if (parseInt(schedule.plannedHours) >= oModel.parameters["GEN-MinWorkTimeForRest"].value / 3600 &&
											oModel.parameters["GEN-MandatoryRest"].value.toUpperCase() === "TRUE") {
											params.postData.totalrestingtime = parseInt(parseFloat(oModel.parameters["GEN-MandatoryRestTime"].value));
											iAddTime += parseFloat(oModel.parameters["GEN-MandatoryRestTime"].value / 3600);
										} else if (oModel.parameters["GEN-MandatoryRest"].value.toUpperCase() === "FALSE") {
											params.postData.totalrestingtime = 0;
										}

										params.postData.recordendtime = params.postData.recordinittime + iAddTime * 3600 * 1000;
										
										params.postData.totalworkingtime = parseInt(parseFloat(schedule.plannedHours) * 3600);
										params.postData.idresttype = 1;
										params.postData.checkextrahours = 1;
										params.postData.checkextrahours = 0;
										params.postData.checkgoodpractices = 0;
										
										/* 30/09/2020 - Añadido el parámetro para que lo restablezca a 0 - @jgalaber */
										params.postData.totalexcesstime = 0;
										/* 30/09/2020 - Añadido el parámetro para que lo restablezca a 0 - @jgalaber */
										
										utils.confirmDialog(that, i18n, params, history);
										excessDialog.close();
										excessDialog.destroy();
									
									/*FIN - 30/09/2020 - Cuando se selecciona el check de no ha excedido la jornada no se debe mantener las horas como extras - @jgalaber */
									} else if (!checkboxNotExceedValue) { //si no está el check de "No tiempo excedido"
										if ((personalTimeValue + workingTimeValue > iSecsCalc)) {
											if (checkboxPersonalValue && checkboxWorkingValue && workingTimeValue !== 0) {
												//error : no se puede poner horas de exceso y de presencia que superen las horas de exceso total
												//sap.m.MessageToast.show(i18n.getText("msgSumaHorasExcesoSuperadas"), { duration: 10000 });
												sap.ui.getCore().byId("mstrpExcessPopUp").setVisible(true);
												sap.ui.getCore().byId("mstrpExcessPopUp").setText(i18n.getText("msgSumaHorasExcesoSuperadas"));
											} else if (checkboxPersonalValue && (!checkboxWorkingValue || workingTimeValue === 0)) {
												//en el caso de tener más horas de descanso que de exceso se restan de las horas de trabajo
												if (that.getView().getModel("oModelReducedSchedule").getData().reducedworkingday &&
													oModel.parameters["GEN-MandatoryRest"].value.toUpperCase() === "TRUE") {
													if (iTotalHoursRecorded * 3600 >= constants.reducedScheduleMandTime) {
														personalTimeValue += parseFloat(oModel.parameters["GEN-MandatoryRestTime"].value);
													}
												} else if (oModel.parameters["GEN-MandatoryRest"].value.toUpperCase() === "TRUE") {
													personalTimeValue += parseInt(oModel.parameters["GEN-MandatoryRestTime"].value);
												}
												dbutils.DBPost(constants.api.urlPostRestingDetail, {
													idemployee: sap.ui.getCore().getModel("userSessions").getData().idemployee,
													recordinitdate: utils.stringifyDate(new Date(utils.voltearFecha(oModel.recordinitdate)), 2),
													startdate: sap.ui.getCore().getModel("userSessions").getData().startdate,
													personalbreak: parseInt(personalTimeValue),
													laboralbreak: workingTimeValue
												}, i18n, function (data) {
													var resultantRestingTime = 0; // = parseInt(oModel.parameters["GEN-MandatoryRestTime"].value);
													var workingTimeExcess = parseFloat(that.getView().getModel("oModelReducedSchedule").getData().plannedHours) *
														3600;
													if (checkboxPersonalValue) {
														resultantRestingTime += personalTimeValue;
													}

													if (checkboxWorkingValue) {
														workingTimeExcess += workingTimeValue;
													}
													/**
													 *  @jgalaber - 27/08/2020
													 *	- Separar tiempo trabajado del excedido, y enviar el tiempo excedido como parámetro aparte
													 * 
													 *  ··· Codigo Antiguo ···
													 		params.postData.totalworkingtime = (iTotalHoursRecorded * 3600) - resultantRestingTime;
													 *  ··· Codigo Antiguo ···
													 * 
													 *  ··· Start ···
													 */
													params.postData.totalworkingtime = (iTotalHoursRecorded * 3600) - resultantRestingTime - workingTimeValue;
													/**
													 *  @jgalaber - 27/08/2020
													 *  ··· End ···
													 */

													params.postData.totalrestingtime = resultantRestingTime;
													params.postData.idresttype = 1;
													if (workingTimeValue > 0) {
														params.postData.checkextrahours = 1;
													} else {
														params.postData.checkextrahours = 0;
													}
													params.postData.checkgoodpractices = 0;
													that.getView().byId("workInput").setValue(utils.clockFormat(params.postData.totalworkingtime / 3600));

													excessDialog.close();
													excessDialog.destroy();
												});
												utils.confirmDialog(that, i18n, params, history);
											} else if (!checkboxPersonalValue && checkboxWorkingValue) {
												//Error, no puedes meter más horas de exceso de las horas excedidas totales
												sap.ui.getCore().byId("mstrpExcessPopUp").setVisible(true);
												sap.ui.getCore().byId("mstrpExcessPopUp").setText(i18n.getText("msgHorasExcesoSuperadas"));
											}
										} else if ((personalTimeValue + workingTimeValue - iSecsCalc <= 59)) {
											//si la suma es perfecta, se mandan los tiempos tal cual al backend
											if (that.getView().getModel("oModelReducedSchedule").getData().reducedworkingday &&
												oModel.parameters["GEN-MandatoryRest"].value.toUpperCase() === "TRUE") {
												if (iTotalHoursRecorded * 3600 >= constants.reducedScheduleMandTime) {
													personalTimeValue += parseFloat(oModel.parameters["GEN-MandatoryRestTime"].value);
												}
											} else if (oModel.parameters["GEN-MandatoryRest"].value.toUpperCase() === "TRUE" &&
												parseInt(oModel.parameters["GEN-MinWorkTimeForRest"].value) < iTotalHoursRecorded * 3600) {
												personalTimeValue += parseFloat(oModel.parameters["GEN-MandatoryRestTime"].value);
											}
											dbutils.DBPost(constants.api.urlPostRestingDetail, {
												idemployee: sap.ui.getCore().getModel("userSessions").getData().idemployee,
												recordinitdate: utils.stringifyDate(new Date(utils.voltearFecha(oModel.recordinitdate)), 2),
												startdate: sap.ui.getCore().getModel("userSessions").getData().startdate,
												personalbreak: parseInt(personalTimeValue),
												totalexcesstime: workingTimeValue
											}, i18n, function (data) {

												//Parte de Jorge adaptada a la nueva lógica
												var resultantRestingTime = 0; // = parseInt(oModel.parameters["GEN-MandatoryRestTime"].value);
												var workingTimeExcess = parseFloat(that.getView().getModel("oModelReducedSchedule").getData().plannedHours) *
													3600;
												//if (checkboxPersonalValue) {
												resultantRestingTime += personalTimeValue;
												//}

												if (checkboxWorkingValue) {
													workingTimeExcess += workingTimeValue;
												}
												/**
												 *  @jgalaber - 27/08/2020
												 *	- Separar tiempo trabajado del excedido, y enviar el tiempo excedido como parámetro aparte
												 * 
												 *  ··· Codigo Antiguo ···
												 		params.postData.totalworkingtime = workingTimeExcess;
												 *  ··· Codigo Antiguo ···
												 * 
												 *  ··· Start ···
												 */
												params.postData.totalworkingtime = (iTotalHoursRecorded * 3600) - resultantRestingTime - workingTimeValue;
												params.postData.totalexcesstime = workingTimeValue;
												/**
												 *  @jgalaber - 27/08/2020
												 *  ··· End ···
												 */

												params.postData.totalrestingtime = resultantRestingTime;
												params.postData.idresttype = 1;
												if (workingTimeValue > 0)
													params.postData.checkextrahours = 1;
												else
													params.postData.checkextrahours = 0;
												params.postData.checkgoodpractices = 0;

												that.getView().byId("workInput").setValue(utils.clockFormat(params.postData.totalworkingtime / 3600));

												excessDialog.close();
												excessDialog.destroy();
											});

											utils.confirmDialog(that, i18n, params, history);
										}
									} else {
										//Nuevo tipo de pop up
										//sap.m.MessageToast.show(i18n.getText("txtHorasPausa"), { duration: 10000 });
										sap.ui.getCore().byId("mstrpExcessPopUp").setVisible(true);
										sap.ui.getCore().byId("mstrpExcessPopUp").setText(i18n.getText("txtHorasPausa"));
									}

								}
							}, 1000);
						}
					}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton")
				]
			});

			excessDialog.getContent()[0].addItem(new sap.m.HBox({
				items: [new sap.m.Text({
					text: i18n.getText("txtRegistroJornadaExcede") + " " + utils.secondsToHoursAndMinutes(hourCalc * 3600) + " " + i18n.getText(
						"txtRecordatorioExcesoTiempo")
				})]
			}));

			excessDialog.getContent()[0].addItem(new sap.m.HBox({
				items: [
					new sap.m.Text({
						text: i18n.getText("txtHorasRealizadasPausasPersonales")
					})
				]
			}));

			excessDialog.getContent()[0].addItem(new sap.m.HBox("inputBoxExcess", {
				items: [
					new sap.m.VBox({
						items: [
							new sap.m.HBox({
								items: [
									new sap.m.CheckBox("motivosPersonales", {
										//text: i18n.getText("lblMotivosPersonales"),
										selected: true,
										select: function (evt) {
											if (!evt.getSource().getSelected() && sap.ui.getCore().byId("pickerPersonalTime").getValue() !== "00:00" && sap.ui
												.getCore()
												.byId("pickerPersonalTime").getValue() !== "0:0") {
												evt.getSource().setSelected(true);
											}

											if (evt.getSource().getSelected())
												sap.ui.getCore().byId("mstrpNoCheckboxSelected").setVisible(false);
										}
									}),
									new sap.m.Label({
										text: i18n.getText("lblMotivosPersonales")
									}).addStyleClass("lblCheckBox"),
									new sap.m.TimePicker("pickerPersonalTime", {
										valueFormat: "HH:mm",
										displayFormat: "HH:mm",
										value: displayedTime,
										width: "100px",
										placeholder: i18n.getText("lblIntroduzcaUnaHora"),
										change: that.validateExcessHours
									})
								]
							}),
							new sap.m.HBox("boxMotivosLaborales", {
								items: [
									new sap.m.CheckBox("motivosLaborales", {
										//text: i18n.getText("lblMotivosLaborales"),
										select: function (evt) {
											if (!evt.getSource().getSelected() && sap.ui.getCore().byId("pickerWorkingTime").getValue() !== "00:00" && sap.ui
												.getCore()
												.byId("pickerWorkingTime").getValue() !== "0:0") {
												evt.getSource().setSelected(true);
											}
											if (evt.getSource().getSelected())
												sap.ui.getCore().byId("mstrpNoCheckboxSelected").setVisible(false);
										}
									}),
									new sap.m.VBox({
										items: [
											new sap.m.Label({
												text: i18n.getText("lblMotivosLaborales1")
											}).addStyleClass("lblCheckBox"),
											new sap.m.Label("motivosLaboralesAlign", {
												text: i18n.getText("lblMotivosLaborales2")
											})
										]
									}),
									new sap.m.TimePicker("pickerWorkingTime", {
										valueFormat: "HH:mm",
										displayFormat: "HH:mm",
										value: "00:00",
										width: "100px",
										placeholder: i18n.getText("lblIntroduzcaUnaHora"),
										change: that.validateExcessHours
									})
								]
							}),
							/*new sap.m.CheckBox("motivosPersonales", {
								text: i18n.getText("lblMotivosPersonales"),
								selected: true,
								select: function (evt) {
									if (!evt.getSource().getSelected() && sap.ui.getCore().byId("pickerPersonalTime").getValue() !== "00:00" && sap.ui.getCore()
										.byId("pickerPersonalTime").getValue() !== "0:0") {
										evt.getSource().setSelected(true);
									}
									if (evt.getSource().getSelected())
										sap.ui.getCore().byId("mstrpNoCheckboxSelected").setVisible(false);
								}
							}), new sap.m.CheckBox("motivosLaborales", {
								text: i18n.getText("lblMotivosLaborales"),
								select: function (evt) {
									if (!evt.getSource().getSelected() && sap.ui.getCore().byId("pickerWorkingTime").getValue() !== "00:00" && sap.ui.getCore()
										.byId("pickerWorkingTime").getValue() !== "0:0") {
										evt.getSource().setSelected(true);
									}
									if (evt.getSource().getSelected())
										sap.ui.getCore().byId("mstrpNoCheckboxSelected").setVisible(false);
								}
							})*/
						],
						width: "500px"
					})
					/*,
										new sap.m.VBox({
											items: [
												new sap.m.TimePicker("pickerPersonalTime", {
													valueFormat: "HH:mm",
													displayFormat: "HH:mm",
													value: displayedTime,
													placeholder: i18n.getText("lblIntroduzcaUnaHora"),
													change: that.validateExcessHours,
													width: "100px"
												}),
												new sap.m.TimePicker("pickerWorkingTime", {
													valueFormat: "HH:mm",
													displayFormat: "HH:mm",
													value: "00:00",
													placeholder: i18n.getText("lblIntroduzcaUnaHora"),
													change: that.validateExcessHours,
													width: "100px"
												})
											]
										})*/
				]
			}));

			excessDialog.getContent()[0].addItem(new sap.m.VBox("inputBoxExcess2", {
				items: [
					new sap.m.HBox({
						items: [
							new sap.m.CheckBox("jornadaNoExcedida", {
								//text: i18n.getText("lblJornadaNoExcedida"),
								select: function (evt) {
									if (evt.getSource().getSelected()) {
										sap.ui.getCore().byId("motivosPersonales").setEnabled(false);
										sap.ui.getCore().byId("motivosLaborales").setEnabled(false);

										sap.ui.getCore().byId("pickerPersonalTime").setEnabled(false);
										sap.ui.getCore().byId("pickerWorkingTime").setEnabled(false);
									} else {
										var personalTimePicker = sap.ui.getCore().byId("pickerPersonalTime");
										var workingTimePicker = sap.ui.getCore().byId("pickerWorkingTime");

										if (personalTimePicker.getDateValue().getMinutes() + personalTimePicker.getDateValue().getHours()) {
											sap.ui.getCore().byId("motivosPersonales").setSelected(true);
										} else {
											sap.ui.getCore().byId("motivosPersonales").setSelected(false);
										}

										if (workingTimePicker.getDateValue().getMinutes() + workingTimePicker.getDateValue().getHours()) {
											sap.ui.getCore().byId("motivosLaborales").setSelected(true);
										} else {
											sap.ui.getCore().byId("motivosLaborales").setSelected(false);
										}

										sap.ui.getCore().byId("motivosPersonales").setEnabled(true);
										sap.ui.getCore().byId("motivosLaborales").setEnabled(true);

										personalTimePicker.setEnabled(true);
										workingTimePicker.setEnabled(true);
									}

									if (evt.getSource().getSelected()) {
										sap.ui.getCore().byId("mstrpNoCheckboxSelected").setVisible(false);
									}
								}
							}),
							new sap.m.Label({
								text: i18n.getText("lblJornadaNoExcedida")
							}).addStyleClass("lblFinalCheckBx")
						]
					}),
					new sap.m.MessageStrip("mstrpNoCheckboxSelected", {
						text: i18n.getText("txtNoCheckboxSelected"),
						showIcon: true,
						type: "Warning",
						showCloseButton: true
					}).setVisible(false),
					new sap.m.MessageStrip("mstrpExcessPopUp", {
						showIcon: true,
						type: "Error",
						showCloseButton: true
					}).setVisible(false)
				]
			}));

			setTimeout(function () {
				if (sap.ui.getCore().byId("informativePopup")) {
					document.getElementById("excessDialog").style.zIndex = 55;
					document.getElementById("sap-ui-blocklayer-popup").style.zIndex = 60;
				}
			}, 10);
			excessDialog.open();
		},

		validateExcessHours: function (oEvent) {
			var that = oController,
				oModel = that.oModelData,
				i18n = that.getOwnerComponent().getModel("i18n").getResourceBundle(),
				iSecsWorkingTime,
				iSecsPersonalTime;

			try {
				iSecsPersonalTime = sap.ui.getCore().byId("pickerPersonalTime").getDateValue().getHours() * 3600 + sap.ui.getCore().byId(
					"pickerPersonalTime").getDateValue().getMinutes() * 60;
			} catch (err) {
				iSecsPersonalTime = 0;
				sap.ui.getCore().byId("pickerPersonalTime").setValue("00:00");
			}

			try {
				iSecsWorkingTime = sap.ui.getCore().byId("pickerWorkingTime").getDateValue().getHours() * 3600 + sap.ui.getCore().byId(
					"pickerWorkingTime").getDateValue().getMinutes() * 60;
			} catch (err) {
				iSecsWorkingTime = 0;
				sap.ui.getCore().byId("pickerWorkingTime").setValue("00:00");
			}

			var iSecsCalc = Math.floor(iTimeExceeded * 3600),
				iTotalHoursRecordable = iTotalHoursRecorded;

			sap.ui.getCore().byId("mstrpExcessPopUp").setVisible(false);

			if (that.getView().getModel("oModelReducedSchedule").getData().reducedworkingday && oModel.parameters["GEN-MandatoryRest"].value.toUpperCase() ===
				"TRUE") {
				if (iTotalHoursRecorded * 3600 >= constants.reducedScheduleMandTime && oModel.parameters["GEN-MandatoryRest"].value.toUpperCase() ===
					"TRUE") {
					iTotalHoursRecordable -= parseInt(oModel.parameters["GEN-MandatoryRestTime"].value) / 3600;
				}
			} else if (oModel.parameters["GEN-MandatoryRest"].value.toUpperCase() === "TRUE" && (iTotalHoursRecordable * 3600 > parseInt(
					oModel
					.parameters["GEN-MinWorkTimeForRest"].value))) {
				//Si supera las horas maximas de trabajo le restamos el tiempo de comida
				iTotalHoursRecordable -= parseInt(oModel.parameters["GEN-MandatoryRestTime"].value) / 3600;
			}

			if (iSecsPersonalTime + iSecsWorkingTime !== iSecsCalc) {
				if (iSecsPersonalTime + iSecsWorkingTime > 24 * 3600) {
					sap.ui.getCore().byId("pickerWorkingTime").setValue("00:00");
					sap.ui.getCore().byId("pickerPersonalTime").setValue(that.calculateTime(iSecsCalc, 0));
					//Nuevo mensaje de error: Message Strip
					//sap.m.MessageToast.show(i18n.getText("msgSumaHorasExcesoSuperan24"), {duration: 10000});
					sap.ui.getCore().byId("mstrpExcessPopUp").setVisible(true);
					sap.ui.getCore().byId("mstrpExcessPopUp").setText(i18n.getText("msgSumaHorasExcesoSuperan24"));
				} else if ((iSecsPersonalTime + iSecsWorkingTime > iSecsCalc)) {
					if (iSecsPersonalTime && sap.ui.getCore().byId("pickerWorkingTime").getValue() === "00:00") {
						if (iSecsPersonalTime > iTotalHoursRecordable * 3600) {
							//en el caso de que las horas personales superen a las horas totales registradas en el día, error
							sap.ui.getCore().byId("mstrpExcessPopUp").setVisible(true);
							sap.ui.getCore().byId("mstrpExcessPopUp").setText(i18n.getText("msgMaximoHorasSuperadas"));
							sap.ui.getCore().byId("pickerPersonalTime").setValue(that.calculateTime(iTotalHoursRecordable * 3600, 0));
						}
						//Sino se manda todo correctamente, se pueden mandar más horas de las excedidas siempre que sean personales y que no superen la jornada total
					} else if (oEvent.getSource().getId() === "pickerWorkingTime" && sap.ui.getCore().byId("pickerWorkingTime").getValue() !==
						"00:00" && iSecsWorkingTime <= iSecsCalc) {
						sap.ui.getCore().byId("pickerPersonalTime").setValue(that.calculateTime(iSecsCalc, iSecsWorkingTime));
					} else {
						sap.ui.getCore().byId("pickerWorkingTime").setValue("00:00");
						sap.ui.getCore().byId("pickerPersonalTime").setValue(that.calculateTime(iSecsCalc, 0));
						//Nuevo mensaje de error: Message Strip
						//sap.m.MessageToast.show(i18n.getText("msgSumaHorasExcesoExcedidas"), {duration: 10000 });
						sap.ui.getCore().byId("mstrpExcessPopUp").setVisible(true);
						sap.ui.getCore().byId("mstrpExcessPopUp").setText(i18n.getText("msgSumaHorasExcesoExcedidas"));
					}
				} else if (oEvent.getSource().getId() === "pickerPersonalTime") {
					sap.ui.getCore().byId("pickerWorkingTime").setValue(that.calculateTime(iSecsCalc, iSecsPersonalTime));
				} else if (oEvent.getSource().getId() === "pickerWorkingTime") {
					sap.ui.getCore().byId("pickerPersonalTime").setValue(that.calculateTime(iSecsCalc, iSecsWorkingTime));
				}
			}

			if (!sap.ui.getCore().byId("motivosLaborales").getSelected() && sap.ui.getCore().byId("pickerWorkingTime").getValue() !== "00:00") {
				sap.ui.getCore().byId("motivosLaborales").setSelected(true);
			}
			if (!sap.ui.getCore().byId("motivosPersonales").getSelected() && sap.ui.getCore().byId("pickerPersonalTime").getValue() !==
				"00:00") {
				sap.ui.getCore().byId("motivosPersonales").setSelected(true);
			}
		},

		/**
		 * Función para calcular las horas de un timepicker en función al otro
		 * @param {integer} iSecsCalc: horas totales de exceso.
		 * @param {interger} iSecsRest: horas a restar a las totales.
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
			return !sap.ui.getCore().byId("mstrpExcessPopUp").getVisible() && !sap.ui.getCore().byId("mstrpNoCheckboxSelected").getVisible();
		},

		/**
		 * Botón Back o Descartar Cambios pulsado. Llama al diálogo de confirmación que permitirá navegar hacia el dashboard
		 * si se pulsa el botón de aceptar.
		 */
		onPressBack: function () {

			var that = this,
				i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle(),
				params = {
					title: i18n.getText("ttlDiscardChanges"),
					text: i18n.getText("msgDiscardChanges"),
					order: "editWorkDayCancel",
					successBtn: i18n.getText("actAccept"),
					exitBtn: i18n.getText("actCancel")
				},
				oHistory = History.getInstance(),
				sPreviousHash = oHistory.getPreviousHash();

			if (this.oModelData.endtimestring === undefined) {
				this.oModelData.endtimestring = "";
			}

			if (this.initialData.endtimestring === undefined) {
				this.initialData.endtimestring = "";
			}

			if (this.oModelData.inittimestring.substr(0, 5) === this.initialData.inittimestring.substr(0, 5) &&
				this.oModelData.endtimestring.substr(0, 5) === this.initialData.endtimestring.substr(0, 5) &&
				this.getView().byId("restInput").getValue() === this.initialData.totalrestingtime.toString() &&
				this.initialData.checkgoodpractices === this.oModelData.checkgoodpractices) {
				if (sPreviousHash !== undefined) {
					window.history.go(-1);
				} else {
					this.oRouter.navTo("home", true);
				}
			} else {
				utils.confirmDialog(that, i18n, params, History);
			}

		},
		/**
		 * Popup para mostrar la política horaria de la empresa, debe aparecer en caso de que se hayan superado las horas planificadas
		 * en el trabajo del día. Después de este, se mostrará otro para confirmar que se quieren guardar los cambios.
		 * @param {Object} that Contexto desde el que se llama al popup. 
		 * @param {Object} i18n Objeto con los textos.
		 * @param {number} idresttype Identificador del tipo de descanso.
		 * @param {number} restdetail Detalle sobre el descanso.
		 * @param {Object} params Objeto con los parámetros que se enviarán a BBDD.
		 * @param {Object} history Objeto que contiene el historial de navegación para volver atrás después del popup.
		 */
		policyPopUp: function (that, i18n, idresttype, restdetail, params, history) {
			var oModelData = this.oModel.getData(),
				input,
				text = new sap.m.Text({
					text: this.oModelData.customText.EFFECTIVEWORKTIME.value
				}),
				dialog;
			that.dialog = dialog;
			var successBtn = new sap.m.Button({
					text: i18n.getText("actAccept"),
					press: function () {
						var value = sap.ui.getCore().byId("extraHoursInput").getValue();
						that.oModelData.state = constants.workDayState.afterWorkDay;
						params.postData.totalworkingtime = value == 0 || value == undefined || value == "" ? 'ERROR' : sap.ui.getCore().byId(
							"extraHoursInput").getValue() * 60 * 60;
						params.postData.checkextrahours = 1;
						params.postData.checkgoodpractices = 0;
						utils.confirmDialog(that, i18n, params, history);
						that.dialog.close();
						that.dialog.destroy();
					}
				}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton"),
				exitBtn = new sap.m.Button({
					text: i18n.getText("actReject"),
					press: function () {
						params.postData.extraHours = sap.ui.getCore().byId("extraHoursInput").getValue() * 60 * 60;
						params.postData.checkextrahours = 0;
						params.postData.checkgoodpractices = 0;
						utils.confirmDialog(that, i18n, params, history);

						that.dialog.close();
						that.dialog.destroy();
						that.getView().byId("saveBtn").setEnabled(true);
						//that.loadData();
					}
				}).addStyleClass("sapMBtnBase sapMBtn footerButton primaryBtn sapUiSmallMarginEnd tlfncThemedButton");

			input = new sap.m.Input("extraHoursInput", {
				description: i18n.getText("lblEffectiveTime"),
				liveChange: function (oEvent) {
					var sNumber = "",
						input = oEvent.getSource(),
						value = parseFloat(input.getValue().replace(',', '.')),
						bNotnumber = isNaN(value),
						maxHours = Math.round(that.oModelData.totalworkingtime / 60 / 60);

					if (!bNotnumber) {
						if (value === 0 || value === undefined || value === "") {
							input.setValueState("Error");
							input.setValueStateText(i18n.getText("msgInvalidWorkedTime"));
						} else if (value < maxHours) {
							sNumber = value;
							input.setValueState("Success");
						} else {
							sNumber = maxHours;
							input.setValueState("Warning");
							input.setValueStateText(i18n.getText("msgInvalidWorkingTime"));
						}
					} else {
						input.setValueState("Error");
						input.setValueStateText(i18n.getText("msgInvalidWorkedTime"));
					}
					oEvent.getSource().setValue(sNumber);
				}
			});
			input.setValue(Math.floor(this.getView().getModel("oModelReducedSchedule").getData().plannedHours));

			utils.popUpPolicy(that, i18n, text, input, successBtn, exitBtn);
		},
		/**
		 * Controla el estado del check de buenas prácticas.
		 */
		onChangeCheckBox: function () {
			var enabled = false,
				editingToday,
				saveBtn = this.getView().byId("saveBtn"),
				entryHourPicker = this.getView().byId("entryHourPicker").getValueState() === 'Error' ? false : true,
				exitHourPicker = this.getView().byId("exitHourPicker").getValueState() === 'Error' ? false : true,
				editedCheck = this.initialData.checkgoodpractices !== this.oModelData.checkgoodpractices ? true : false;

			if (this.oModelData.schEditingToday) {
				editingToday = this.oModelData.schEditingToday;
			} else {
				editingToday = this.oModelData.editingToday;
			}

			if (editingToday) {
				if ((entryHourPicker && !exitHourPicker) || (entryHourPicker && exitHourPicker)) {
					enabled = this.checkChanges();
				}
			} else if (entryHourPicker && exitHourPicker) {
				enabled = this.checkChanges();
			}

			saveBtn.setEnabled(enabled);
		},
		/*Formateador para booleanos y ckeckboxes. Añadido recpara mejorar la compatibilidad con la vista del horario*/
		formatterBoolean: function (sValue) {
			var veredicto = false;
			if (sValue === true || sValue === 1 || sValue === '1') {
				veredicto = true;
			}
			return veredicto;
		},

		checkChanges: function () {
			var editedCheck = this.initialData.checkgoodpractices !== this.oModelData.checkgoodpractices ? true : false,
				editedInitTime = this.initialData.inittimestring.substr(0, 5) !== this.oModelData.inittimestring.substr(0, 5) ? true : false,
				editedEndTime = this.initialData.endtimestring.substr(0, 5) !== this.oModelData.endtimestring.substr(0, 5) ? true : false,
				editedRestTime = this.initialData.totalrestingtime !== this.oModelData.totalrestingtime ? true : false;

			if (editedCheck || editedInitTime || editedEndTime || editedRestTime) {
				return true;
			}
			return false;
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
		showInformativePopup: function (title, description, isImportant) {
			var i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			var test = new sap.m.Dialog("informativePopup", { //"informativeExcessDialog",
				title: title,
				content: new sap.m.VBox(),
				endButton: new sap.m.Button({
					text: i18n.getText("actAccept"),
					press: function () {
						setTimeout(function () {
							document.getElementById("sap-ui-blocklayer-popup").style.zIndex = document.getElementById("excessDialog").style.zIndex -
								2;
						}, 500);
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
				var test = new sap.m.Dialog("exceededTimeDialog", { //"informativeExcessDialog",
					title: i18n.getText("ttlTiempoInactividadSuperado"),
					content: new sap.m.VBox()
				}).addStyleClass("informativeExcessDialog");

				test.getContent()[0].addItem(new sap.m.HBox({
					items: [new sap.m.Text({
						text: i18n.getText("lblTiempoInactividad")
					})]
				}));

				setTimeout(function () {
					if (sap.ui.getCore().byId("informativePopup")) {
						document.getElementById("exceededTimeDialog").style.zIndex = "80";
						document.getElementById("sap-ui-blocklayer-popup").style.zIndex = 78;
					}
				}, 10);

				test.open();
			}
		}
	});
});