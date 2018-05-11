;(function main(window) {
	'use strict'

	const document = window.document,
		location = document.location,
		docEl = document.documentElement,
		$ = e => document.querySelector(e)

	function injectCSS(file) {
		let style = document.createElement('link')
		style.id = 'ige_style'
		style.rel = 'stylesheet'
		style.href = chrome.extension.getURL(`content/${file}.css`)
		document.head.appendChild(style) // we don't need to append it to the body to prevent blocking rendering, as it requires a (huge) reflow anyway
		style = null
	}
	injectCSS('content') // inject as early as possible

	// block middle mouse button
	window.addEventListener('click', e => (e.button > 0 ? e.stopPropagation() : undefined), true)

	// prevent vid restart
	window.addEventListener('blur', e => e.stopPropagation(), true)
	window.addEventListener('visibilitychange', e => e.stopPropagation(), true)

	/**
	 * Creates a new observer, starts observing and returns the observer.
	 *
	 * @param {Node} elem Element to observe
	 * @param {MutationCallback} fn Mutation Callback
	 * @param {MutationOptions} options Options
	 * @return {MutationObserver} Callback
	 */
	function observe(elem, fn, options) {
		const observer = new MutationObserver(fn)
		if (elem) observer.observe(elem, options)

		return {
			observe(el) {
				observer.observe(el, options) // MutationObservers have no unobserve, so we just return an observe function.
			},
			disconnect() {
				observer.disconnect()
			},
		}
	}

	/**
	 * Observe for node changes and add video controls if needed.
	 */
	const root = document.getElementById('react-root')
	observe(
		document.body,
		mutations => {
			for (let i = 0; i < mutations.length; ++i) {
				const mutation = mutations[i],
					added = mutation.addedNodes

				for (let x = 0; x < added.length; ++x) {
					const el = added[x]
					Promise.resolve()
						.then(handleNode.bind(undefined, el, mutation))
						.catch(console.error)
				}
			}
		},
		{ childList: true, subtree: true }
	)

	const handleNodeFns = {
		DIV(node) {
			node.querySelectorAll('img').forEach(fullPhoto)
			node.querySelectorAll('video').forEach(addControls)
		},
		ARTICLE(node) {
			handleNodeFns.DIV(node)
		},

		VIDEO: addControls,
		IMG: fullPhoto,

		SECTION(node) {
			handleNodeFns.DIV(node)
		},
	}

	function handleNode(node, mutation) {
		const nodeName = node.nodeName
		if (mutation.target.id === 'react-root' && nodeName === 'SECTION') onChange()
		handleNodeFns[nodeName] !== undefined && handleNodeFns[nodeName](node)
	}

	let hasNavigated = false,
		prevUrl = location.href,
		currentClass = ''

	/**
	 * Checks the URL for changes.
	 */
	function checkURL() {
		if (location.href !== prevUrl) {
			prevUrl = location.href
			hasNavigated = true
			onNavigate()
		}
	}

	/**
	 * Sets the correct currentClass.
	 *
	 * .home on the main homepage
	 * .profile on user profiles
	 * .post when a single post is open (also as modal)
	 * .explore if the explore tab is open
	 * .stories when stories are open
	 */
	function decideClass() {
		const pathname = location.pathname

		if (
			(hasNavigated && (location.search.indexOf('tagged') !== -1 || location.search.indexOf('taken-by=') !== -1)) ||
			$('div[role="dialog"]') !== null
		)
			return (currentClass = '')

		// home page
		if (pathname === '/') return (currentClass = 'home')

		// stories
		if (pathname.indexOf('/stories/') !== -1) return (currentClass = 'stories')

		// single post
		if (pathname.indexOf('/p/') !== -1) return (currentClass = 'post')

		// search results
		if (pathname.indexOf('/explore/') !== -1) return (currentClass = 'explore')

		// profile page
		return (currentClass = 'profile')
	}

	function addClass() {
		if (currentClass === '' || root.classList.contains(currentClass)) return

		root.classList.remove('home', 'profile', 'post', 'explore', 'stories')
		root.classList.add(currentClass)
	}

	const Instagram = {
		liked: new window.getInstagram('liked'),
		saved: new window.getInstagram('saved'),
	}
	console.log((window.Instagram = Instagram)) // for debugging

	function addExtendedButton() {
		let anchor = document.getElementsByClassName('coreSpriteDesktopNavProfile')
		if (!anchor.length) anchor = $('header > div > button')

		anchor = anchor[0].parentNode
		const el = anchor.cloneNode(true),
			a = el.firstChild

		a.className = ''
		a.classList.add('coreSpriteOptionsEllipsis', 'extended--btn')

		let clickedExtendedBtn = true
		if (window.localStorage.clickedExtendedBtn === undefined) {
			a.classList.add('extended--btn__new')
			clickedExtendedBtn = false
		}

		a.href = '#'
		a.nodeValue = '' // clear content
		a.textContent = ''
		a.title = 'Improved Layout for Instagram'
		a.addEventListener('click', function(e) {
			e.preventDefault()

			Instagram.liked
				.start()
				.then(Instagram.liked.fetch)
				.catch(console.error)
			Instagram.saved
				.start()
				.then(Instagram.saved.fetch)
				.catch(console.error)

			chrome.runtime.sendMessage(null, { action: 'click' })
			if (!clickedExtendedBtn) window.localStorage.clickedExtendedBtn = true
		})
		el.style.transform = 'translateY(4px) scale(1.2)'
		anchor.after(el)
	}

	const listenerActions = {
		load(request) {
			return Instagram[request.which].fetch()
		},

		_action(request) {
			return Instagram[request.which][request.action] !== undefined && Instagram[request.which][request.action](request.id)
		},

		add(request) {
			return this._action(request)
		},

		remove(request) {
			return this._action(request)
		},
	}

	function addListener() {
		chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
			if (listenerActions[request.action] !== undefined && Instagram[request.which] !== undefined) {
				listenerActions[request.action](request)
			}
		})
	}

	function addNamesToStories() {
		const list = document.querySelectorAll(
			'main > section > div:first-child:not(#rcr-anchor) ~ div:last-child > hr:first-of-type + div + div > div > div > a > div > div > span'
		)

		var regex = /\./g
		for (let i = 0; i < list.length; ++i) {
			var elem = list[i]
			elem.parentElement.parentElement.parentElement.parentElement.id = `igs_${elem.innerText.replace(regex, 'dot')}`
		}
	}

	function changeStyle(target) {
		const bottom = target.style.paddingBottom,
			top = target.style.paddingTop === '0px' && bottom === '0px' ? '100px' : target.style.paddingTop

		console.log(top, bottom)
		target.style.paddingLeft = top
		target.style.paddingRight = bottom
	}

	const vlObserver = observe(
		undefined,
		mutations => {
			if (mutations.length === 0) return

			window.requestIdleCallback(changeStyle.bind(undefined, mutations[0].target))
			window.requestIdleCallback(addNamesToStories)
		},
		{ childList: true, subtree: true }
	)
	function fixVirtualList() {
		const $el = $('main > section > div:first-child:not(#rcr-anchor) ~ div:last-child > hr:first-of-type + div + div > div')
		if ($el !== null) vlObserver.observe($el) // virtual stories list
	}

	const connection = navigator.connection.type,
		speed = navigator.connection.downlink,
		fullsizeObserver = observe(
			undefined,
			mutations => {
				for (let i = 0; i < mutations.length; ++i) {
					const mutation = mutations[i].target

					if (mutation.sizes !== '1080px') mutation.sizes = '1080px'
				}
			},
			{ attributes: true, attributeFilter: ['sizes'] }
		)

	/**
	 * Free observers to prevent memory leaks.
	 */
	function disconnectObservers() {
		fullsizeObserver.disconnect()
		vlObserver.disconnect()
	}

	/**
	 *
	 * @param {HTMLImageElement} el Image
	 */
	function fullPhoto(el) {
		if (!el) return

		el.decoding = 'async'
		if (connection === 'wifi' && speed > 3.0) {
			el.sizes = '1080px'
			fullsizeObserver.observe(el)
		}
	}

	/**
	 * Adds controls to videos and preloads if needed.
	 * @param {HTMLVideoElement} el Video
	 */
	function addControls(el) {
		if (!el) return

		el.controls = 'true'
		if (currentClass === 'post' || currentClass === 'profile') el.preload = 'auto'
	}

	function setBoxWidth(i) {
		docEl.style.setProperty('--boxWidth', `${i}vw`)
	}

	let OPTIONS = null
	const OPTS_MODE = {
		blockStories(value) {
			for (let i = 0; i < value.length; ++i) {
				document.getElementById(`igs_${value[i]}`).style.display = 'none'
			}
		},
		//highlightOP(arg) {},
		_boxWidth(i) {},
		rows(i) {
			if (i !== 4) setBoxWidth(100 / i - 1)
		},
		boxWidth(i) {
			if (OPTIONS.rows === 2 && i > 25 && i !== 49) setBoxWidth(i)
			if (OPTIONS.rows === 4 && i < 25 && i !== 23) setBoxWidth(i)
		},

		// boolean toggles
		klass(cls) {
			root.classList.add(cls)
		},
		night(arg) {
			const hour = new Date().getHours()
			if ((hour >= OPTIONS.nightModeStart && hour < OPTIONS.nightModeEnd) || OPTIONS.nightModeStart === OPTIONS.nightModeEnd)
				injectCSS('night')
		},
		only3Dot(arg) {
			$('#ige_style').remove()
		},
	}
	const OPTS = {
		// blockPosts: null, // []
		blockStories: OPTS_MODE.blockStories, // []
		night: OPTS_MODE.night,
		nightModeStart: undefined,
		nightModeEnd: undefined,
		picturesOnly: OPTS_MODE.klass,
		hideStories: OPTS_MODE.klass,
		noSpaceBetweenPosts: OPTS_MODE.klass,
		hideRecommended: OPTS_MODE.klass,
		highlightOP: OPTS_MODE.highlightOP,
		only3Dot: OPTS_MODE.only3Dot,
		rows: OPTS_MODE.rows,
		rowsFourBoxWidth: OPTS_MODE.boxWidth,
		rowsTwoBoxWidth: OPTS_MODE.boxWidth,
		// indicateFollowing: true
	}

	function loadOptions() {
		window.IG_Storage.get('options', null)
			.then(function cb(options) {
				if (options === null) return options
				OPTIONS = options

				for (const optName in options) {
					const oFn = OPTS[optName]
					if (oFn === undefined) continue

					const optValue = options[optName]
					if (typeof optValue === 'boolean') optValue && oFn(`ige_${optName}`)
					else oFn(optValue)
				}
				return options
			})
			.catch(console.error)
	}

	OPTS_MODE.rows(window.innerWidth < 1367 ? 2 : 4)

	/**
	 * Callback when nodes are removed/inserted.
	 */
	function onChange() {
		checkURL()
	}

	/**
	 * Callback when an url navigation has happened.
	 */
	function onNavigate() {
		disconnectObservers()
		decideClass()
		window.requestIdleCallback(() =>
			window.requestAnimationFrame(() => {
				window.requestAnimationFrame(() => {
					addClass()
					if (currentClass === 'home') fixVirtualList()
				})
			})
		) // double-rAF
	}

	/**
	 * Callback when DOM is ready.
	 */
	function onReady() {
		const $elem = $('div > article')
		if ($elem !== null) docEl.style.setProperty('--boxHeight', `${$elem.offsetHeight}px`) // give boxes equal height

		decideClass()
		addClass()
		loadOptions()
		onNavigate()
		window.requestIdleCallback(() =>
			window.requestAnimationFrame(() => {
				window.requestAnimationFrame(() => {
					document.body.querySelectorAll('video').forEach(addControls)
					document.body.querySelectorAll('img').forEach(fullPhoto)
					if (currentClass === 'home') fixVirtualList()
				})
			})
		) // double-rAF

		addExtendedButton()
		addListener()
	}

	if (document.readyState === 'interactive' || document.readyState === 'complete') onReady()
	else document.addEventListener('DOMContentLoaded', onReady)
})(window)
