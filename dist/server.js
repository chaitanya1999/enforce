const jsforceAjaxProxy = require('jsforce-ajax-proxy');
const express = require('express')
const app = express()
const port = process.env.PORT || 80
let env = process.env.NODE_ENV || 'development';

let jsforceCorsProxy = jsforceAjaxProxy({enableCORS : (env == 'PROD' ? false : true)});

app.get('/:file', (req, res) => {
	console.log(req.params.file);
 
	if(!req.params.file) {
		res.sendFile('/web/index.html', { root: __dirname });
	} else if(req.params.file.startsWith('proxy')) {
		console.log('proxy proxy #$#$');
		jsforceCorsProxy(req, res);	
	} else {
		res.sendFile('/web/' + req.params.file, { root: __dirname });
	}
})
app.get('/', (req,res) => {
	res.sendFile('/web/index.html', { root: __dirname });
});

app.use('/assets/', express.static(__dirname + '/web/assets/'));

app.use('/assets/monaco/vs/', express.static(__dirname + '/web/assets/monaco/vs/'));

app.all('/proxy/?*', jsforceCorsProxy);

app.listen(port, () => {
	console.log(`EnForce Server [${env}] listening at PORT : ${port}`);
})