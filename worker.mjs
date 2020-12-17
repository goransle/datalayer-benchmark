import DataModifier from 'https://github.highcharts.com/enhancement/data-layer/Data/Modifiers/DataModifier.js';
import Chain from 'https://github.highcharts.com/enhancement/data-layer/Data/Modifiers/ChainDataModifier.js';
import 'https://github.highcharts.com/enhancement/data-layer/Data/Modifiers/InvertModifier.js';
import 'https://github.highcharts.com/enhancement/data-layer/Data/Modifiers/RangeDataModifier.js';
import 'https://github.highcharts.com/enhancement/data-layer/Data/Modifiers/GroupDataModifier.js';
import DataTable from 'https://github.highcharts.com/enhancement/data-layer/Data/DataTable.js';

// Event system checks for document, which the webworker
DataModifier.prototype.emit = () => void 0;
DataTable.prototype.emit = () => void 0;

async function runTest(dataTable, chain) {
    const report = {
        startTime: self.performance.now()
    };
    chain.execute(dataTable);
    report.endTime = self.performance.now();
    report.timeSpent = report.endTime - report.startTime;

    postMessage(report);
}

onmessage = function (e) {
    const { chainJSON, dataTableJSON } = e.data;
    if (chainJSON && dataTableJSON) {
        const chain = Chain.fromJSON(chainJSON);
        const dataTable = DataTable.fromJSON(dataTableJSON);
        runTest(dataTable, chain);
    }
};