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
    var existingObj = cy.getElementById(data.data.id);
    if (existingObj && existingObj.length === 0) {
        cy.add(data);
        cy.layout();
    }
});
socket.on('add-edge', function (data) {
    cy.add(data);
    cy.layout();
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
        layout: { name: 'random' }
    });
});