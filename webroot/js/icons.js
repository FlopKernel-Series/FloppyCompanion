/*
 * icons.js
 *
 * Central icon registry for the WebUI.
 *
 * Many icons are sourced from Google Material Symbols.
 * https://fonts.google.com/icons
 */

(function () {
	'use strict';

	var SVG_NS = 'http://www.w3.org/2000/svg';

	/**
	 * Icon definitions.
	 *
	 * Format:
	 * - viewBox: string
	 * - paths: array of path "d" strings OR objects { d, fill }
	 */
	var ICONS = {
		// App chrome / navigation (24x24)
		arrow_back: {
			viewBox: '0 -960 960 960',
			paths: [
				'm313-440 224 224-57 56-320-320 320-320 57 56-224 2' +
					'24h487v80H313Z'
			]
		},
		language: {
			viewBox: '0 -960 960 960',
			paths: [
				'M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325' +
					'T80-480q0-83 31.5-155.5t86-127Q252-817 325-848.5T4' +
					'80-880q83 0 155.5 31.5t127 86q54.5 54.5 86 127T880' +
					'-480q0 82-31.5 155t-86 127.5q-54.5 54.5-127 86T480' +
					'-80Zm0-82q26-36 45-75t31-83H404q12 44 31 83t45 75Z' +
					'm-104-16q-18-33-31.5-68.5T322-320H204q29 50 72.5 8' +
					'7t99.5 55Zm208 0q56-18 99.5-55t72.5-87H638q-9 38-2' +
					'2.5 73.5T584-178ZM170-400h136q-3-20-4.5-39.5T300-4' +
					'80q0-21 1.5-40.5T306-560H170q-5 20-7.5 39.5T160-48' +
					'0q0 21 2.5 40.5T170-400Zm216 0h188q3-20 4.5-39.5T5' +
					'80-480q0-21-1.5-40.5T574-560H386q-3 20-4.5 39.5T38' +
					'0-480q0 21 1.5 40.5T386-400Zm268 0h136q5-20 7.5-39' +
					'.5T800-480q0-21-2.5-40.5T790-560H654q3 20 4.5 39.5' +
					'T660-480q0 21-1.5 40.5T654-400Zm-16-240h118q-29-50' +
					'-72.5-87T584-782q18 33 31.5 68.5T638-640Zm-234 0h1' +
					'52q-12-44-31-83t-45-75q-26 36-45 75t-31 83Zm-200 0' +
					'h118q9-38 22.5-73.5T376-782q-56 18-99.5 55T204-640' +
					'Z'
			]
		},
		restart_alt: {
			viewBox: '0 -960 960 960',
			paths: [
				'M440-122q-121-15-200.5-105.5T160-440q0-66 26-126.5' +
					'T260-672l57 57q-38 34-57.5 79T240-440q0 88 56 155.' +
					'5T440-202v80Zm80 0v-80q87-16 143.5-83T720-440q0-10' +
					'0-70-170t-170-70h-3l44 44-56 56-140-140 140-140 56' +
					' 56-44 44h3q134 0 227 93t93 227q0 121-79.5 211.5T5' +
					'20-122Z'
			]
		},

		// Material Symbols
		thermal: {
			viewBox: '0 -960 960 960',
			paths: [
				'M480-80q-83 0-141.5-58.5T280-280q0-48 21-89.5t59-70.5v-320q0-50 35-85t85-35q50 0 85 35t35 85v320q38 29 59 70.5t21 89.5q0 83-58.5 141.5T480-80Zm-40-440h80v-40h-40v-40h40v-80h-40v-40h40v-40q0-17-11.5-28.5T480-800q-17 0-28.5 11.5T440-760v240Z'
			]
		},
		undervolt: {
			viewBox: '0 -960 960 960',
			paths: [
				'm422-232 207-248H469l29-227-185 267h139l-30 208ZM320-80l40-280H160l360-520h80l-40 320h240L400-80h-80Zm151-390Z'
			]
		},
		misc: {
			viewBox: '0 -960 960 960',
			paths: [
				'M160-120q-33 0-56.5-23.5T80-200v-560q0-33 23.5-56.5T160-840h560q33 0 56.5 23.5T800-760v80h80v80h-80v80h80v80h-80v80h80v80h-80v80q0 33-23.5 56.5T720-120H160Zm0-80h560v-560H160v560Zm80-80h200v-160H240v160Zm240-280h160v-120H480v120Zm-240 80h200v-200H240v200Zm240 200h160v-240H480v240ZM160-760v560-560Z'
			]
		},
		soundcontrol: {
			viewBox: '0 -960 960 960',
			paths: [
				'M360-120H200q-33 0-56.5-23.5T120-200v-280q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480v280q0 33-23.5 56.5T760-120H600v-320h160v-40q0-117-81.5-198.5T480-760q-117 0-198.5 81.5T200-480v40h160v320Zm-80-240h-80v160h80v-160Zm400 0v160h80v-160h-80Zm-400 0h-80 80Zm400 0h80-80Z'
			]
		},
		battery_android_share: {
			viewBox: '0 -960 960 960',
			paths: [
				'M160-240q-50 0-85-35t-35-85v-240q0-50 35-85t85-35h567l-80 80H160q-17 0-28.5 11.5T120-600v240q0 17 11.5 28.5T160-320h280v80H160Zm-40-400v320-320Zm400 320v-120q0-33 23.5-56.5T600-520h167l-63-64 56-56 160 160-160 160-57-57 64-63H600v120h-80Z'
			]
		},

		// Inline icons moved over from the UI
		chip: {
			viewBox: '0 -960 960 960',
			paths: [
				'M360-360v-240h240v240H360Zm80-80h80v-80h-80v80Zm-8' +
					'0 320v-80h-80q-33 0-56.5-23.5T200-280v-80h-80v-80h' +
					'80v-80h-80v-80h80v-80q0-33 23.5-56.5T280-760h80v-8' +
					'0h80v80h80v-80h80v80h80q33 0 56.5 23.5T760-680v80h' +
					'80v80h-80v80h80v80h-80v80q0 33-23.5 56.5T680-200h-' +
					'80v80h-80v-80h-80v80h-80Zm320-160v-400H280v400h400' +
					'ZM480-480Z'
			]
		},
		zram: {
			viewBox: '0 -960 960 960',
			paths: [
				'M360-360v-240h240v240H360Zm80-80h80v-80h-80v80Zm-8' +
					'0 320v-80h-80q-33 0-56.5-23.5T200-280v-80h-80v-80h' +
					'80v-80h-80v-80h80v-80q0-33 23.5-56.5T280-760h80v-8' +
					'0h80v80h80v-80h80v80h80q33 0 56.5 23.5T760-680v80h' +
					'80v80h-80v80h80v80h-80v80q0 33-23.5 56.5T680-200h-' +
					'80v80h-80v-80h-80v80h-80Zm320-160v-400H280v400h400' +
					'ZM480-480Z'
			]
		},
		memory: {
			viewBox: '0 -960 960 960',
			paths: [
				'M240-360h80v-240h-80v240Zm200 0h80v-240h-80v240Zm2' +
					'00 0h80v-240h-80v240Zm-480 80h640v-400H160v400Zm0 ' +
					'0v-400 400Zm40 160v-80h-40q-33 0-56.5-23.5T80-280v' +
					'-400q0-33 23.5-56.5T160-760h40v-80h80v80h160v-80h8' +
					'0v80h160v-80h80v80h40q33 0 56.5 23.5T880-680v400q0' +
					' 33-23.5 56.5T800-200h-40v80h-80v-80H520v80h-80v-8' +
					'0H280v80h-80Z'
			]
		},
		storage: {
			viewBox: '0 -960 960 960',
			paths: [
				'M120-160v-160h720v160H120Zm80-40h80v-80h-80v80Zm-8' +
					'0-440v-160h720v160H120Zm80-40h80v-80h-80v80Zm-80 2' +
					'80v-160h720v160H120Zm80-40h80v-80h-80v80Z'
			]
		},
		iosched: {
			viewBox: '0 -960 960 960',
			paths: [
				'M120-160v-160h720v160H120Zm80-40h80v-80h-80v80Zm-8' +
					'0-440v-160h720v160H120Zm80-40h80v-80h-80v80Zm-80 2' +
					'80v-160h720v160H120Zm80-40h80v-80h-80v80Z'
			]
		},

		// Status / UI glyphs (24x24)
		home: {
			viewBox: '0 -960 960 960',
			paths: [
				'M240-200h120v-240h240v240h120v-360L480-740 240-560' +
					'v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80' +
					'v240H160Zm320-350Z'
			]
		},
		extension: {
			viewBox: '0 -960 960 960',
			paths: [
				'M352-120H200q-33 0-56.5-23.5T120-200v-152q48 0 84-' +
					'30.5t36-77.5q0-47-36-77.5T120-568v-152q0-33 23.5-5' +
					'6.5T200-800h160q0-42 29-71t71-29q42 0 71 29t29 71h' +
					'160q33 0 56.5 23.5T800-720v160q42 0 71 29t29 71q0 ' +
					'42-29 71t-71 29v160q0 33-23.5 56.5T720-120H568q0-5' +
					'0-31.5-85T460-240q-45 0-76.5 35T352-120Zm-152-80h8' +
					'5q24-66 77-93t98-27q45 0 98 27t77 93h85v-240h80q8 ' +
					'0 14-6t6-14q0-8-6-14t-14-6h-80v-240H480v-80q0-8-6-' +
					'14t-14-6q-8 0-14 6t-6 14v80H200v88q54 20 87 67t33 ' +
					'105q0 57-33 104t-87 68v88Zm260-260Z'
			]
		},
		tune: {
			viewBox: '0 0 24 24',
			paths: [
				'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z'
			]
		},
		build: {
			viewBox: '0 -960 960 960',
			paths: [
				'M686-132 444-376q-20 8-40.5 12t-43.5 4q-100 0-170-' +
					'70t-70-170q0-36 10-68.5t28-61.5l146 146 72-72-146-' +
					'146q29-18 61.5-28t68.5-10q100 0 170 70t70 170q0 23' +
					'-4 43.5T584-516l244 242q12 12 12 29t-12 29l-84 84q' +
					'-12 12-29 12t-29-12Zm29-85 27-27-256-256q18-20 26-' +
					'46.5t8-53.5q0-60-38.5-104.5T386-758l74 74q12 12 12' +
					' 28t-12 28L332-500q-12 12-28 12t-28-12l-74-74q9 57' +
					' 53.5 95.5T360-440q26 0 52-8t47-25l256 256ZM472-48' +
					'8Z'
			]
		},
		download: {
			viewBox: '0 -960 960 960',
			paths: [
				'M480-320 280-520l56-58 104 104v-326h80v326l104-104' +
					' 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-1' +
					'20h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H2' +
					'40Z'
			]
		},
		open_in_new: {
			viewBox: '0 -960 960 960',
			paths: [
				'M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56' +
					'.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.' +
					'5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h' +
					'280v280h-80v-144L388-332Z'
			]
		},
		github: {
			viewBox: '0 0 24 24',
			paths: [
				'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z'
			]
		},
		import: {
			viewBox: '0 -960 960 960',
			paths: [
				'M440-160v-326L336-382l-56-58 200-200 200 200-56 58' +
					'-104-104v326h-80ZM160-600v-120q0-33 23.5-56.5T240-' +
					'800h480q33 0 56.5 23.5T800-720v120h-80v-120H240v12' +
					'0h-80Z'
			]
		},
		export: {
			viewBox: '0 -960 960 960',
			paths: [
				'M480-480ZM202-65l-56-57 118-118h-90v-80h226v226h-8' +
					'0v-89L202-65Zm278-15v-80h240v-440H520v-200H240v400' +
					'h-80v-400q0-33 23.5-56.5T240-880h320l240 240v480q0' +
					' 33-23.5 56.5T720-80H480Z'
			]
		},
		check: {
			viewBox: '0 -960 960 960',
			paths: [
				'M382-240 154-468l57-57 171 171 367-367 57 57-424 4' +
					'24Z'
			]
		},
		refresh: {
			viewBox: '0 -960 960 960',
			paths: [
				'M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93' +
					'q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32' +
					'-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70' +
					' 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t' +
					'-196 67Z'
			]
		},
		warning_triangle: {
			viewBox: '0 -960 960 960',
			paths: [
				'm40-120 440-760 440 760H40Zm138-80h604L480-720 178' +
					'-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5' +
					'T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T48' +
					'0-240Zm-40-120h80v-200h-80v200Zm40-100Z'
			]
		},
		warning: {
			viewBox: '0 -960 960 960',
			paths: [
				'm40-120 440-760 440 760H40Zm138-80h604L480-720 178' +
					'-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5' +
					'T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T48' +
					'0-240Zm-40-120h80v-200h-80v200Zm40-100Z'
			]
		},
		warning_circle: {
			viewBox: '0 0 24 24',
			paths: [
				'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'
			]
		},
		info: {
			viewBox: '0 0 24 24',
			paths: [
				'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'
			]
		},
		info_outline: {
			viewBox: '0 -960 960 960',
			paths: [
				'M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T52' +
					'0-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-6' +
					'40q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T19' +
					'7-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763' +
					'q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 5' +
					'4 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-12' +
					'7 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-2' +
					'27t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 ' +
					'93Zm0-320Z'
			]
		},
		reboot: {
			viewBox: '0 -960 960 960',
			paths: [
				'M440-122q-121-15-200.5-105.5T160-440q0-66 26-126.5' +
					'T260-672l57 57q-38 34-57.5 79T240-440q0 88 56 155.' +
					'5T440-202v80Zm80 0v-80q87-16 143.5-83T720-440q0-10' +
					'0-70-170t-170-70h-3l44 44-56 56-140-140 140-140 56' +
					' 56-44 44h3q134 0 227 93t93 227q0 121-79.5 211.5T5' +
					'20-122Z'
			]
		},
		check_circle: {
			viewBox: '0 -960 960 960',
			paths: [
				'm424-296 282-282-56-56-226 226-114-114-56 56 170 1' +
					'70Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T' +
					'80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-88' +
					'0q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 8' +
					'3-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q13' +
					'4 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 ' +
					'93t-93 227q0 134 93 227t227 93Zm0-320Z'
			]
		},
		success: {
			viewBox: '0 -960 960 960',
			paths: [
				'm424-296 282-282-56-56-226 226-114-114-56 56 170 1' +
					'70Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T' +
					'80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-88' +
					'0q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 8' +
					'3-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q13' +
					'4 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 ' +
					'93t-93 227q0 134 93 227t227 93Zm0-320Z'
			]
		},
		save: {
			viewBox: '0 -960 960 960',
			paths: [
				'M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5' +
					'-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 ' +
					'160Zm-80 34L646-760H200v560h560v-446ZM480-240q50 0' +
					' 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q' +
					'0 50 35 85t85 35ZM240-560h360v-160H240v160Zm-40-86' +
					'v446-560 114Z'
			]
		},

		// Theme icons (24x24)
		theme_dark: {
			viewBox: '0 -960 960 960',
			paths: [
				'M480-120q-150 0-255-105T120-480q0-150 105-255t255-' +
					'105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 ' +
					'90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5' +
					't1 27.5q0 150-105 255T480-120Zm0-80q88 0 158-48.5T' +
					'740-375q-20 5-40 8t-40 3q-123 0-209.5-86.5T364-660' +
					'q0-20 3-40t8-40q-78 32-126.5 102T200-480q0 116 82 ' +
					'198t198 82Zm-10-270Z'
			]
		},
		theme_light: {
			viewBox: '0 -960 960 960',
			paths: [
				'M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-' +
					'85 35t-35 85q0 50 35 85t85 35Zm0 80q-83 0-141.5-58' +
					'.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5' +
					'T680-480q0 83-58.5 141.5T480-280ZM200-440H40v-80h1' +
					'60v80Zm720 0H760v-80h160v80ZM440-760v-160h80v160h-' +
					'80Zm0 720v-160h80v160h-80ZM256-650l-101-97 57-59 9' +
					'6 100-52 56Zm492 496-97-101 53-55 101 97-57 59Zm-9' +
					'8-550 97-101 59 57-100 96-56-52ZM154-212l101-97 55' +
					' 53-97 101-59-57Zm326-268Z'
			]
		},
		theme_auto: {
			viewBox: '0 0 24 24',
			paths: [
				// Custom Auto Icon: Sun Rays + Bold Sans-Serif 'A'
				'M11 9 H13 L15.2 15.5 H13.2 L12.7 14 H11.3 L10.8 15.5 H8.8 Z M12 10.5 L12.3 12.5 H11.7 Z M2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z'
			]
		}
	};

	function escapeAttr(value) {
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	function getIconDef(name) {
		var key = String(name || '').trim();
		return key ? ICONS[key] || null : null;
	}

	function createSvg(name, opts) {
		opts = opts || {};
		var def = getIconDef(name);
		if (!def) return null;

		var svg = document.createElementNS(SVG_NS, 'svg');
		if (opts.className) svg.setAttribute('class', opts.className);
		svg.setAttribute('viewBox', opts.viewBox || def.viewBox || '0 0 24 24');

		if (opts.width) svg.setAttribute('width', String(opts.width));
		if (opts.height) svg.setAttribute('height', String(opts.height));

		if (opts.ariaLabel) {
			svg.setAttribute('role', 'img');
			svg.setAttribute('aria-label', String(opts.ariaLabel));
		} else {
			svg.setAttribute('aria-hidden', 'true');
		}

		var paths = def.paths || [];
		for (var i = 0; i < paths.length; i++) {
			var p = paths[i];
			var path = document.createElementNS(SVG_NS, 'path');
			if (typeof p === 'string') {
				path.setAttribute('d', p);
			} else if (p && p.d) {
				path.setAttribute('d', p.d);
				if (p.fill) path.setAttribute('fill', p.fill);
			}
			if (!path.getAttribute('fill')) {
				path.setAttribute('fill', opts.fill || 'currentColor');
			}
			svg.appendChild(path);
		}

		return svg;
	}

	function svgString(name, opts) {
		opts = opts || {};
		var def = getIconDef(name);
		if (!def) return '';

		var viewBox = escapeAttr(opts.viewBox || def.viewBox || '0 0 24 24');
		var cls = opts.className ? ' class="' + escapeAttr(opts.className) + '"' : '';
		var w = opts.width ? ' width="' + escapeAttr(opts.width) + '"' : '';
		var h = opts.height ? ' height="' + escapeAttr(opts.height) + '"' : '';
		var aria = opts.ariaLabel
			? ' role="img" aria-label="' + escapeAttr(opts.ariaLabel) + '"'
			: ' aria-hidden="true"';

		var fill = escapeAttr(opts.fill || 'currentColor');

		var paths = def.paths || [];
		var out = '<svg' + cls + ' viewBox="' + viewBox + '"' + w + h + aria + '>';
		for (var i = 0; i < paths.length; i++) {
			var p = paths[i];
			if (typeof p === 'string') {
				out += '<path fill="' + fill + '" d="' + escapeAttr(p) + '"></path>';
			} else if (p && p.d) {
				out += '<path fill="' + escapeAttr(p.fill || fill) + '" d="' + escapeAttr(p.d) + '"></path>';
			}
		}
		out += '</svg>';
		return out;
	}

	function applyToSvg(svgEl, name, opts) {
		opts = opts || {};
		var def = getIconDef(name);
		if (!def || !svgEl) return false;

		svgEl.setAttribute('viewBox', opts.viewBox || def.viewBox || '0 0 24 24');
		while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

		var paths = def.paths || [];
		for (var i = 0; i < paths.length; i++) {
			var p = paths[i];
			var path = document.createElementNS(SVG_NS, 'path');
			if (typeof p === 'string') {
				path.setAttribute('d', p);
			} else if (p && p.d) {
				path.setAttribute('d', p.d);
				if (p.fill) path.setAttribute('fill', p.fill);
			}
			if (!path.getAttribute('fill')) {
				path.setAttribute('fill', opts.fill || 'currentColor');
			}
			svgEl.appendChild(path);
		}

		return true;
	}

	function applyDataIcons(root) {
		var ctx = root || document;
		if (!ctx || !ctx.querySelectorAll) return 0;

		var svgs = ctx.querySelectorAll('svg[data-icon]');
		for (var i = 0; i < svgs.length; i++) {
			var svg = svgs[i];
			var name = svg.getAttribute('data-icon');
			if (!name) continue;
			var fill = svg.getAttribute('data-icon-fill');
			applyToSvg(svg, name, fill ? { fill: fill } : {});
		}

		return svgs.length;
	}

	window.FC = window.FC || {};
	window.FC.icons = {
		get: getIconDef,
		createSvg: createSvg,
		svgString: svgString,
		applyToSvg: applyToSvg,
		applyDataIcons: applyDataIcons
	};
})();

