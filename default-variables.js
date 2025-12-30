const superrackMidiMap = JSON.stringify(require('./superrack-midi-map.json'))

const getEmptyTemplate = (rackCount) => {
	let racks = []
	for (let rack = 1; rack <= rackCount; rack++) {
		racks[rack] = {
			id: rack,
			value: null,
		}
	}
	return racks
}

module.exports = {
	rackCount: 64,
	channelCount: 128,
	midi: superrackMidiMap,
	httpSettings: { server: null, port: 8010, started: false },
	logLevel: 'error',
	hotPlugin: { type: 'cc', channel: 1, mapping: getEmptyTemplate(12), emptyMapping: getEmptyTemplate(12) },
	mapping: getEmptyTemplate,
}
