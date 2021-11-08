sap.ui.define([], function () {
	"use strict";

	return {

		setBanneImage: function () {
			var sLanguage = sap.ui.getCore().getConfiguration().getLanguage().toLowerCase();
			return (sLanguage.includes("en")) ? "/images/banner_eng.jpg" :  "/images/banner.jpg";
		},
		
		formatDate: function(date) {
			var dateObject = date;
			var result = "";
			
			if(typeof date === "object") {
				result = (dateObject.getDate() < 10 ? "0" + dateObject.getDate() : dateObject.getDate()) + "/" +
				(dateObject.getMonth() < 10 ? "0" + dateObject.getMonth() : dateObject.getMonth()) + "/" +
				dateObject.getFullYear();
			} else {
				result = date;
			}
			
			return result;
		},
		
		/**
		 *	@description Retorna los segundos pasados a formato HH:mm para los objetos TimePicker
		 *	@param	{Integer}	seconds Cantidad de tiempo en segundos
		 *	@return {String}	result	String con formato HH:mm
		 */
		secondsToTimePickerStringFormat: function(seconds) {
		 	var hours	= Math.floor(seconds / 60 / 60),
				minutes = Math.round(seconds / 60 % 60);
			return hours + ":" + minutes;
		},
		
		/**
		 *	@description Retorna los minutos pasados a formato HH:mm para los objetos TimePicker
		 *	@param	{Integer}	minutes Cantidad de tiempo en minutos
		 *	@return {String}	result	String con formato HH:mm
		 */
		minutesToTimePickerStringFormat: function(seconds){
			var hours = Math.floor(seconds / 60);
			hours = (hours < 10) ? `0${hours}`: hours;
			
			var minutes = Math.floor(seconds % 60);
			minutes = (minutes < 10) ? `0${minutes}` : minutes;
		
			return `${hours}:${minutes}`;
		}, 
		
		formatStringDate: function(date){
			return (date) ? `${date.split("T")[0]} ${date.split("T")[1].slice(0, 8)}` : "";
		}
	};
});
