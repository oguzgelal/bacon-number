// this is the js file that will run on the front-end
// aim is to handle the graph
var cy;
var socket = io('http://localhost:3001');
socket.on('connect', function () { console.log('ws connected'); });
socket.on('disconnect', function () { console.log('ws disconnected'); });

socket.on('progress', function (data) {
    console.log(data);
});

socket.on('add-node', function (data) {
    cy.add(data);
    console.log('Adding node, ', data);
});
socket.on('add-edge', function (data) {
    cy.add(data);
    console.log('Adding edge, ', data);
});
socket.on('result-found', function (data) {
    alert('Result Found!');
    console.log(data);
});

function search() {
    socket.emit('search', {
        target_url: document.getElementById('target_url').value,
        source_url: document.getElementById('source_url').value
    });
}

$(document).ready(function () {
    cy = cytoscape({
        container: document.getElementById('graph-container'),
        style: [
            {
                selector: 'node[type = "movie"]',
                style: {
                    'label': 'data(name)',
                    'background-color': 'red'
                }
            },
            {
                selector: 'node[type = "actor"]',
                style: {
                    'label': 'data(name)',
                    'background-color': 'blue'
                }
            }
        ],
        layout: { name: 'preset' }
    });
});