'use strict'

const cookieObj = {
	url: 'https://www.instagram.com/',
	name: '',
}
const url = chrome.runtime.getURL('index.html')

let tab = null /* store tab id */
/**
 * Called after a tab has been created.
 *
 * @param {Number} newTab
 */
function create(newTab) {
	tab = newTab
}

/**
 * Called after a tab has been updated.
 */
function updated() {
	if (chrome.runtime.lastError) createTab(this, true) // only create new tab when there was an error
}

/**
 * Creates a new tab.
 *
 * @param {Number} id
 * @param {Boolean} force
 */
function createTab(id, force) {
	if (tab !== null && !force) {
		chrome.tabs.update(tab.id, { active: true, url: url + '?tabid=' + id }, updated.bind(id))
	} else {
		chrome.tabs.create({ url: url + '?tabid=' + id }, create)
	}
}

function getCookie(name) {
	return new Promise((resolve, reject) => {
		cookieObj.name = name
		chrome.cookies.get(cookieObj, function cookies(cookie) {
			if (cookie !== null) resolve(cookie.value)
			reject()
		})
	})
}

let sessionid = ''
function saveSession(value) {
	return (sessionid = value)
}
function getSessionId() {
	getCookie('sessionid').then(saveSession)
}

getSessionId()

chrome.runtime.onMessage.addListener(function listener(request, sender, sendResponse) {
	if (request.action === 'click') createTab(sender.tab.id, false)
})

// Hook into web request and modify headers before sending the request
chrome.webRequest.onBeforeSendHeaders.addListener(
	function listener(details) {
		getSessionId() // just update for next time

		const headers = details.requestHeaders

		for (let i = 0; i < headers.length; ++i) {
			const header = headers[i]

			if (header.name === 'User-Agent') {
				header.value = 'Instagram 10.8.0 Android (24/7.0; 380dpi; 1080x1920; OnePlus; ONEPLUS A3010; OnePlus3T; qcom; en_US)'
			} else if (header.name === 'Cookie') {
				// add auth cookies to authenticate API requests
				header.value = header.value + '; sessionid=' + sessionid
			}
		}

		return { requestHeaders: headers }
	},
	{
		urls: ['https://i.instagram.com/api/v1/feed/liked/*', 'https://i.instagram.com/api/v1/feed/saved/*'],
		types: ['xmlhttprequest'],
	},
	['blocking', 'requestHeaders']
)
