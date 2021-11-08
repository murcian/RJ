sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"epicfichajes/epicfichajes/model/models",
	"epicfichajes/epicfichajes/utils/utils",
	"epicfichajes/epicfichajes/utils/dbutils",
	"epicfichajes/epicfichajes/utils/constants",
	"epicfichajes/epicfichajes/utils/cookies"
], function (UIComponent, Device, models) {
	"use strict";

	return UIComponent.extend("epicfichajes.epicfichajes.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// enable routing
			this.getRouter().initialize();

			// set the device model
			this.setModel(models.createDeviceModel(), "device");
			
			// // set EditRecord MODEL
			// this.setModel(models.createEditRecordModel(), "editRecordModel");
		}
	});
});