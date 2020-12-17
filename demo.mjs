import Table from 'https://github.highcharts.com/enhancement/data-layer/Data/DataTable.js';
import DataModifier from 'https://github.highcharts.com/enhancement/data-layer/Data/Modifiers/DataModifier.js';
import 'https://github.highcharts.com/enhancement/data-layer/Data/Modifiers/InvertModifier.js';
import 'https://github.highcharts.com/enhancement/data-layer/Data/Modifiers/RangeDataModifier.js';
import 'https://github.highcharts.com/enhancement/data-layer/Data/Modifiers/GroupDataModifier.js';
import Chain from 'https://github.highcharts.com/enhancement/data-layer/Data/Modifiers/ChainDataModifier.js';

const { fireEvent, addEvent } = Highcharts;
const chartData = [];
const runs = [{}];

const getCurrentRun = () => runs[runs.length -1];

let thisRun = getCurrentRun();

const chart = Highcharts.chart('chart', {
    title: {
        text: 'Just a chart'
    },
    chart: {
        type: 'boxplot',
        zoomType: 'xy'
    },
    yAxis: [{
        title: {
            text: 'Milliseconds'
        }
    }],
    xAxis: {
        title: {
            text: 'Number of data rows'
        }
    },
    series: [{
        type: 'boxplot',
        data: []
    }]

});

const container = document.querySelector('#container');
let previousEvent;


function cleanUp() {
    const run = getCurrentRun()
    if (run.state) {
        delete run.state.dataTable;
        delete run.state.results;
        run.state.results = [];
        run.state.iterations = 0;
        delete run.state.modifiers;
    }
}

function setupData(rowsToInsert) {
    const dataRow = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rows = [];
    thisRun.state.rows = rowsToInsert;

    while (rows.length < rowsToInsert) {
        rows.push(dataRow);
    }

    const table = Table.fromJSON({ rows });
    console.log(table.watchsIdMap);
    thisRun.state.dataTable = table;
}

function setUpRun() {
    const run = getCurrentRun();
    run.state = {};
    run.state.results = [];
    run.state.modifiers = {};
    run.state.iterations = Number(document.querySelector('#iterations').value) || 10;
    run.state.rows = Number(document.querySelector('#rows').value);
    run.state.threshold = Number(document.querySelector('#threshold').value);
}


function report() {
    const { results } = thisRun?.state;
    if (results && results.length) {
        results.sort((a, b) => a - b);

        const sum = results.reduce((a, b) => a + b);
        const median = (results[(results.length - 1) >> 1] + results[results.length >> 1]) / 2;
        const diffArr = results.map(a => (a - median) ** 2);
        const stdDeviation = Math.sqrt(diffArr.reduce((a, b) => a + b) / (results.length - 1));

        const quantile = (arr, q) => {
            const pos = (results.length - 1) * q;
            const base = Math.floor(pos);
            const rest = pos - base;
            if (results[base + 1] !== undefined) {
                return results[base] + rest * (results[base + 1] - results[base]);
            }
            return results[base];

        };

        const q1 = quantile(results, 0.25);
        const q3 = quantile(results, 0.75);

        const reportObj = {
            Fastest: results[0],
            Slowest: results[results.length - 1],
            Average: sum / results.length,
            Median: median,
            Deviation: stdDeviation
        };

        const boxPlotData = {
            x: thisRun.state.rows,
            low: reportObj.Fastest,
            high: reportObj.Slowest,
            median,
            q1,
            q3
        };

        chartData.push(boxPlotData);
        if(!thisRun.points){
            thisRun.points = []
        }
        results.forEach(result =>
             thisRun.points.push([thisRun.state.rows, result])
        );
        chart.series[0].setData(
            [...chartData]
        );

        console.log(`Data after ${results.length} runs with ${thisRun.state.dataTable.rows.length} rows:`, reportObj);
    }

}
console.log(window.performance);

function createChain() {
    const modifiers = DataModifier.getAllModifiers();
    const modifiersToAdd = Object.keys(modifiers).map(key => {
        thisRun.state.modifiers[key] = { results: [] };
        const modifier = modifiers[key];

        const options = {};
        if (key === "Range") {
            options.ranges = [{
                maxValue: 5,
                minValue: 5
            }];
            options.strict = true;
        }

        return new modifier();
    });
    return new Chain({}, ...modifiersToAdd);
}

const worker = new Worker('./worker.mjs', { type: 'module' });
let handlerAdded = false;
const runBenchmarkInWebWorker = () => {
    // module type seems to only be supported in chrome & edge
    const chain = createChain();
    const chainJSON = chain.toJSON();
    const dataTableJSON = thisRun.state.dataTable.toJSON();
    if (!handlerAdded) {
        worker.onmessage = e => {
            thisRun.state.results.push(e.data.timeSpent);
            if (thisRun.state.results.length === thisRun.state.iterations) {
                container.dispatchEvent(new Event('afterBenchmark'));
                return;
            }
            // Run again
            runBenchmarkInWebWorker();
        };
        handlerAdded = true;
    }
    worker.postMessage({ chainJSON, dataTableJSON });
};

const runBenchmarkInMain = () => {
    const chain = createChain();
    const { dataTable } = thisRun.state;

    if (!thisRun.state.eventAdded) {
        chain.on('afterBenchmark', (e) => {
            thisRun.state.results = e.results;
            fireEvent(container, 'afterBenchmark');
        });

        thisRun.state.eventAdded = true;
    }

    return chain.benchmark(dataTable, {
        iterations: thisRun.state.iterations
    });
    // thisRun.state.results = results;
};
const run = (e, rows) => {
    thisRun = getCurrentRun()
    cleanUp();
    setUpRun();
    setupData(rows ? rows : thisRun.state.rows);
    thisRun.state.eventCallback = addEvent(container, 'afterBenchmark', e => {
        report();
    });

    const runInWebworker = document.querySelector('#webworkertoggle').checked;
    runInWebworker ? runBenchmarkInWebWorker() : runBenchmarkInMain();
};

const runRampTest = e => {
    thisRun = getCurrentRun()
    thisRun.state = {}
    thisRun.state.rows = 1000;
    addEvent(container, 'afterBenchmark', (e) => {
        if (thisRun.state && thisRun.state.eventCallback) {
            thisRun.state.eventCallback();
            thisRun.state.eventCallback = undefined;
        }
        report();
        if (thisRun.state.results.reduce((a, b) => a + b) / thisRun.state.results.length < (thisRun.state.threshold || 200)) {
            // Run again
            thisRun.state.rows *= 1.15;
            run(e, thisRun.state.rows);
            return;
        }
        chart.addSeries({
            regression: true,
            regressionSettings: {
                type: 'linear',
                color: 'rgba(223, 83, 83, .9)'
            },
            name: `Points, run ${runs.length}`,
            type: 'scatter',
            data: thisRun.points
        });

        runs.push({})
    });
    run(e, thisRun.state.rows);

};

document.querySelector('#rerun').addEventListener('click', run);
document.querySelector('#startramp').addEventListener('click', runRampTest);