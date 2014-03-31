var fs = require('fs');
var url = require('url');
var zlib = require('zlib');
var crypto = require('crypto');
var mime = require('mime');


var DEFAULT_MAX_SIZE = 200 * 1024;
/*
Options:
url - url to serve from
path - path to file
cache - How long (in seconds) to cache this file, default is uncached
type - Content type
stream - Stream, or keep in memory
compress - if we make compressed version available
*/
function File(opts) {
	this.path = opts.path;
	this.stream = opts.stream;
	this.compress = opts.compress || true;
	this.type = opts.type || mime.lookup(this.path);
	this.cache = opts.cache || 0;

	// Load file, if smaller than 500kb, keep in mem by default, option
	// TODO: Start watching file
	var self = this;
	var timeout;
	fs.watch(this.path, {persistent: false}, function() {
		if(timeout == null) { // Wait since events sometimes fire multiple times in quick succession
			timeout = setTimeout(function() {
				self._setup();
				timeout = null;
			}, 20);
		}
	});
	this._setup();
}
File.prototype._setup = function(type, name) {
	delete this.fileData;
	delete this.zippedData;

	var self = this;
	fs.stat(this.path, function(err, stats) {
		if(err) {
			self.notFound = true;
			return;
		}
		self.size = stats.size;
		self.modified = stats.mtime.getTime();
		if(self.stream == null) {
			self.stream = (self.size > DEFAULT_MAX_SIZE);
		}

		if(!self.stream) {
			fs.readFile(self.path, function(err, data) {
				self.fileData = data;
				self.etag = crypto.createHash('md5').update(data).digest('hex');

				if(self.compress) zlib.gzip(data, function(err, zipped) {
					if(zipped.length < (data.length * 0.9)) {
						self.zippedData = zipped;
					}
				});
			});
		} else {
			var s = fs.createReadStream(self.path);
			var h = crypto.createHash('md5');
			s.pipe(h, {end: false});
			s.on('end', function() {
				self.etag = h.digest('hex');
			});
		}
	});

	
}
File.prototype.serve = function(req, res) {
	if(this.notFound) {
		res.writeHead(404);
		res.end('404 File Not Found');
		return;
	}

	var h = {
		'Content-Type': this.type,
		'ETag': this.etag
	};

	var modifiedSince = req.headers['if-modified-since'];
	var noneMatch = req.headers['if-none-match'];
	if(modifiedSince != null && this.modified <= new Date(modifiedSince).getTime()) {
		res.writeHead(304);
		res.end();
		return;
	} else if(noneMatch != null && noneMatch === this.etag) {
		res.writeHead(304);
		res.end();
		return;
	}

	var data;
	var acceptEncoding = req.headers['accept-encoding'];
	var compress = (acceptEncoding != null && acceptEncoding.indexOf('gzip') !== -1) && this.compress;
	if(compress) {
		h['Content-Encoding'] = 'gzip';
		if(this.zippedData) {
			data = this.zippedData;
			h['Content-Length'] = data.length;
		}
	} else {
		h['Content-Length'] = this.size;
		if(this.fileData) {
			data = this.fileData;
		}
	}

	if(this.cache > 0) {
		h['Cache-Control'] = 'max-age=' + this.cache;
	}

	if(req.method === 'HEAD') {
		res.writeHead(200, h);
		res.end();
		return;
	}

	res.writeHead(200, h);
	if(data) {
		res.end(data);
	} else {
		var s = fs.createReadStream(this.path);
		if(compress) {
			s.pipe(zlib.createGzip()).pipe(res);
		} else {
			s.pipe(res);
		}
	}
}

// TODO: Write tests and update README

function createMiddlware(files) {
	var table = {};
	files.forEach(function(file) {
		table[file.url] = new File(file);
	});

	return function(req, res, next) {
		var path = url.parse(req.url).pathname;

		if(req.method !== 'GET' && req.method !== 'HEAD') {
			if(next) next();
			else {
				res.writeHead(405);
				res.end('405 Method not allowed');
			}
			return;
		}

		var file = table[path];
		if(file) {
			file.serve(req, res);
		} else {
			next();
		}
	}
}

createMiddlware.File = File;
module.exports = createMiddlware;
