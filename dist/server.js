const jsforceAjaxProxy = require('jsforce-ajax-proxy');
const express = require('express')
const app = express()
const port = process.env.PORT || 80
let env = process.env.NODE_ENV || 'development';
let staticOptions = {
	maxAge : 86400000,
	etag : true
}
let jsforceCorsProxy = jsforceAjaxProxy({enableCORS : (env == 'PROD' ? false : true)});

app.get('/:file', (req, res) => {
	console.log('#$#$ Request = ' + req.params.file);
 
	if(!req.params.file) {
		res.sendFile('/web/index.html', { root: __dirname });
	} else if(req.params.file.startsWith('proxy')) {
		console.log('#$#$ Proxy request');
		jsforceCorsProxy(req, res);	
	} else {
		res.sendFile('/web/' + req.params.file, { root: __dirname });
	}
})
app.get('/', (req,res) => {
	res.sendFile('/web/index.html', { root: __dirname });
});

app.use('/assets/', express.static(__dirname + '/web/assets/', staticOptions));

app.use('/assets/monaco/vs/', express.static(__dirname + '/web/assets/monaco/vs/'));

app.all('/proxy/?*', jsforceCorsProxy);

app.listen(port, () => {
	console.log(`EnForce Server [${env}] listening at PORT : ${port}`);
})