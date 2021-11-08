	var constants = {
		//Url de los scripts de BBDD
		api: {
			urlDev: "/destinations/TLFNC_PICKING",
			urlProcessing: "/destinations/TLFNC_PROCESSES",
			urlPostRecord: "/records/postRecordEmployee.xsjs",
			urlGetAllRecords: "/records/getAllRecordsEmployee.xsjs",
			urlGetRecord: "/records/getRecordEmployeeByDate.xsjs",
			urlGetDailyRecords: "/records/getDailyRecordsEmployeeByDate.xsjs",
			urlGetLastDailyRecords: "/records/getDayliRecordsEmployeeByDateStatus.xsjs",
			urlGetHolidays: "/employeeholidays/getHolidays.xsjs",
			urlGetCalendars: "/calendars/getCalendars.xsjs",
			urlloginCheck: "/login/Login.xsjs",
			urlGetWorkScheduleEmployeeByDate: "/workschedules/getWorkScheduleEmployeeByDate.xsjs",
			urlGetRestReasons: "/resttypes/getRestTypes.xsjs",
			urlGetParameterization: "/parameterization/getParametersByCompany.xsjs",
			urlGetCustomText: "/customtext/getCustomText.xsjs",
			urlUpdateSecurityPolicy: "/employees/updateSecurityPolicy.xsjs",
			urlEmployeeRoles: "/employees/getEmployeesRoles.xsjs",
			urlCompaniesLogos: "/companies/getCompanyLogo.xsjs",
			urlGenerateCSVEmployee: "/csv/employee",
			urlPostRestingDetail: "/records/postRestingDetail.xsjs",
			urlPostEditRecordBreak: "/breaks/editRecordBreak.xsjs",
			urlPostRecordBreaks: "/breaks/postRecordBreak.xsjs"
		},
		SFSF: {
			QuaURL: "hcm12preview.sapsf.eu/login?company=TFNDEV2",
			DevURL: "hcm12preview.sapsf.eu/login?company=TFNQA"
		},

		//Estados de la jornada
		workDayState: {
			working: 1,
			resting: 2,
			beforeWorkDay: 5,
			afterResting: 3,
			afterWorkDay: 4
		},
		//Tipos de registro
		regType: {
			auto: 1,
			manual: 2,
			edited: 3
		},
		//Iniciales dias de la semana
		initialDays: {
			0: "L",
			1: "M",
			2: "X",
			3: "J",
			4: "V",
			5: "S",
			6: "D"
		},
		//Iconos
		icons: {
			workDayIcon: "sap-icon://laptop",
			unspecifiedIcon: "sap-icon://incident"
		},
		//Tiempos de carga
		timeouts: {
			dashboard: 1500,
			schedule: 1000
		},
		//5 Horas en segundos
		reducedScheduleMandTime: 18000, 
		//
		iMinExcessMargin: 5

	};