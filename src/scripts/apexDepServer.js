const express = require('express');
const app = express();
const path = require('path');

app.get('/:file', (req, res) => {
	console.log('#$#$ Request = ' + req.params.file);
    // if(req.params.file.includes('graphology-layout')) {
    //     res.sendFile('/graphology-layout/' + req.params.file, { root: __dirname });
    // } else {
        res.sendFile('/' + req.params.file, { root: __dirname });
    // }
})
// app.get('/graphology-layout/:file', (req, res) => {
// 	console.log('#$#$ Request = ' + req.params.file);
//     res.sendFile('/graphology-layout/' + req.params.file, { root: __dirname });
// })
// app.get('/graphology-types/:file', (req, res) => {
// 	console.log('#$#$ Request = ' + req.params.file);
//     res.sendFile('/graphology-types/' + req.params.file, { root: __dirname });
// })
// app.get('/graphology-utils/:file', (req, res) => {
// 	console.log('#$#$ Request = ' + req.params.file);
//     res.sendFile('/graphology-utils/' + req.params.file, { root: __dirname });
// })

app.listen(3030);