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

const getHotPluginMapping = () => {
	return [
		null,
		{ id: 1, value: 1 },
		{ id: 2, value: 2 },
		{ id: 3, value: 3 },
		{ id: 4, value: 4 },
		{ id: 5, value: 5 },
		{ id: 6, value: 6 },
		{ id: 7, value: 7 },
		{ id: 8, value: 8 },
		{ id: 9, value: 9 },
		{ id: 10, value: 10 },
		{ id: 11, value: 11 },
		{ id: 12, value: 12 },
	]
}

const getHotSnapshotMapping = () => {
	return [
		null,
		{ id: 1, value: 1 },
		{ id: 2, value: 2 },
		{ id: 3, value: 3 },
		{ id: 4, value: 4 },
		{ id: 5, value: 5 },
		{ id: 6, value: 6 },
	]
}

const getHotMap = () => {
	return [
		{ rack: 1, plugin: 1, snapshot: 1 },
		{ rack: 2, plugin: 2, snapshot: 1 },
		{ rack: 3, plugin: 3, snapshot: 1 },
		{ rack: 4, plugin: 4, snapshot: 1 },
		{ rack: 5, plugin: 5, snapshot: 1 },
		{ rack: 6, plugin: 6, snapshot: 1 },
		{ rack: 7, plugin: 7, snapshot: 1 },
		{ rack: 8, plugin: 8, snapshot: 1 },
		{ rack: 9, plugin: 9, snapshot: 1 },
		{ rack: 10, plugin: 10, snapshot: 1 },
		{ rack: 11, plugin: 11, snapshot: 1 },
		{ rack: 12, plugin: 12, snapshot: 1 },
		{ rack: 13, plugin: 1, snapshot: 2 },
		{ rack: 14, plugin: 2, snapshot: 2 },
		{ rack: 15, plugin: 3, snapshot: 2 },
		{ rack: 16, plugin: 4, snapshot: 2 },
		{ rack: 17, plugin: 5, snapshot: 2 },
		{ rack: 18, plugin: 6, snapshot: 2 },
		{ rack: 19, plugin: 7, snapshot: 2 },
		{ rack: 20, plugin: 8, snapshot: 2 },
		{ rack: 21, plugin: 9, snapshot: 2 },
		{ rack: 22, plugin: 10, snapshot: 2 },
		{ rack: 23, plugin: 11, snapshot: 2 },
		{ rack: 24, plugin: 12, snapshot: 2 },
		{ rack: 25, plugin: 1, snapshot: 3 },
		{ rack: 26, plugin: 2, snapshot: 3 },
		{ rack: 27, plugin: 3, snapshot: 3 },
		{ rack: 28, plugin: 4, snapshot: 3 },
		{ rack: 29, plugin: 5, snapshot: 3 },
		{ rack: 30, plugin: 6, snapshot: 3 },
		{ rack: 31, plugin: 7, snapshot: 3 },
		{ rack: 32, plugin: 8, snapshot: 3 },
		{ rack: 33, plugin: 9, snapshot: 3 },
		{ rack: 34, plugin: 10, snapshot: 3 },
		{ rack: 35, plugin: 11, snapshot: 3 },
		{ rack: 36, plugin: 12, snapshot: 3 },
		{ rack: 37, plugin: 1, snapshot: 4 },
		{ rack: 38, plugin: 2, snapshot: 4 },
		{ rack: 39, plugin: 3, snapshot: 4 },
		{ rack: 40, plugin: 4, snapshot: 4 },
		{ rack: 41, plugin: 5, snapshot: 4 },
		{ rack: 42, plugin: 6, snapshot: 4 },
		{ rack: 43, plugin: 7, snapshot: 4 },
		{ rack: 44, plugin: 8, snapshot: 4 },
		{ rack: 45, plugin: 9, snapshot: 4 },
		{ rack: 46, plugin: 10, snapshot: 4 },
		{ rack: 47, plugin: 11, snapshot: 4 },
		{ rack: 48, plugin: 12, snapshot: 4 },
		{ rack: 49, plugin: 1, snapshot: 5 },
		{ rack: 50, plugin: 2, snapshot: 5 },
		{ rack: 51, plugin: 3, snapshot: 5 },
		{ rack: 52, plugin: 4, snapshot: 5 },
		{ rack: 53, plugin: 5, snapshot: 5 },
		{ rack: 54, plugin: 6, snapshot: 5 },
		{ rack: 55, plugin: 7, snapshot: 5 },
		{ rack: 56, plugin: 8, snapshot: 5 },
		{ rack: 57, plugin: 9, snapshot: 5 },
		{ rack: 58, plugin: 10, snapshot: 5 },
		{ rack: 59, plugin: 11, snapshot: 5 },
		{ rack: 60, plugin: 12, snapshot: 5 },
		{ rack: 61, plugin: 1, snapshot: 6 },
		{ rack: 62, plugin: 2, snapshot: 6 },
		{ rack: 63, plugin: 3, snapshot: 6 },
		{ rack: 64, plugin: 4, snapshot: 6 },
	]
}

module.exports = {
	rackCount: 64,
	channelCount: 128,
	hotMap: getHotMap(),
	httpSettings: { server: null, port: 8010, started: false },
	logLevel: 'error',
	hotPlugin: { type: 'cc', channel: 1, mapping: getHotPluginMapping(), emptyMapping: getEmptyTemplate(12) },
	hotSnapshot: { type: 'cc', channel: 2, mapping: getHotSnapshotMapping(), emptyMapping: getEmptyTemplate(6) },
	mapping: getEmptyTemplate,
}
