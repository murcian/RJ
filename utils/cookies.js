var cookies = {};
/**
 * Función que guarda una cookie encriptada con los parámetros especificados.
 * @param {string} name: nombre de la cookie.
 * @param {array} value: valor de la cookie.
 * @param {integer} days: tiempo de validez de la cookie en días.
 */
cookies.setCookie = function (name, value) {

	var expires = "",
		date = new Date(),
		tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
		offset = cookies.getOffset(tomorrow),
		expireDate = new Date(offset),
		expireDateMinutes = new Date(date.getTime()+600000);

	expires = "; expires=" + expireDate.toString();
	if (window.localStorage) {
		localStorage.setItem("expireCookie", expires.split("=")[1].split(" GMT")[0]);
	}
	document.cookie = name + "=" + (btoa(JSON.stringify(value)) || "") + expires + "; Path=/";

};
/**
 * Función que guarda una cookie en formato texto con los parámetros especificados.
 * @param {string} name: nombre de la cookie.
 * @param {array} value: valor de la cookie.
 * @param {integer} days: tiempo de validez de la cookie en días.
 */
/*cookies.setCookieNoBase64 = function (name, value, days) {
	var expires = "";
	if (days) {
		var date = new Date();
		date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
		expires = "; expires=" + date.toUTCString();
	}
	document.cookie = name + "=" + ((value) || "") + expires + "; Path=/";
};*/
/**
 * Función que recupera una cookie encriptada.
 * @param {string} name: nombre de la cookie.
 */
cookies.getCookie = function (name) {
	try {
		var nameEQ = name + "=";
		var ca = document.cookie.split(';');
		for (var i = 0; i < ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0) === ' ') {
				c = c.substring(1, c.length);
			}
			if (c.indexOf(nameEQ) === 0) {
				return JSON.parse(atob(c.substring(nameEQ.length, c.length)));
			}
		}
		return null;
	} catch (e) {
		////console.log(e.message);
		return null;
	}
};
/**
 * Función que recupera una cookie.
 * @param {string} name: nombre de la cookie.
 */
/*cookies.getCookieNoBase64 = function (name) {
	try {
		var nameEQ = name + "=";
		var ca = document.cookie.split(';');
		for (var i = 0; i < ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0) === ' ') c = c.substring(1, c.length);
			if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
		}
		return null;
	} catch (e) {
		////console.log(e.message);
		return null;
	}
};*/
/**
 * Función que elimina una cookie.
 * @param {string} name: nombre de la cookie.
 */
cookies.eraseCookie = function (name) {
	document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
};

/**
 * Función que obtiene la diferencia en milisegundos con el horario GMT para enviarlo al servidor
 * @param {Date} date: fecha sobre la que obtener la diferencia.
 * @returns {int}: milisegundos de diferencia.
 */
cookies.getOffset = function (date) {

	var time = date.getTime(date),
		offset = date.getTimezoneOffset() * 60 * 1000;

	return time - offset;
};