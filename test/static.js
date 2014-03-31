var static = require('../static');
var http = require('http');
var fs = require('fs');
var assert = require('assert');
var path = require('path');

var filename1 = path.join(__dirname, 'testfile1.txt');
var filename2 = path.join(__dirname, 'testfile2.css');
var testfile = path.join(__dirname, 'test.txt');
fs.writeFileSync(testfile, fs.readFileSync(filename1));

var CONTENT1 = '3k24jkl 3k24jkl 3k24jkl 3k24jkl';
var CONTENT2 = 'kljkljdaslfjdi3qj4j32kl4j2kljflkfaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

var files;
function request(method, url, headers, cb) {
	var req = {
		method: method,
		url: url,
		headers: headers
	};
	var r = {};
	var res = {
		writeHead: function(status, headers) {
			r.statusCode = status;
			r.headers = {};
			Object.keys(headers || {}).forEach(function(header) {
				r.headers[header.toLowerCase()] = headers[header];
			});
		},
		end: function(data) {
			r.body = data;
			cb(r);
		}
	};
	
	files(req, res);
}

describe('ex-static', function() {
	var etag;
	before(function(done) {
		files = static([
			{path: testfile, url: '/', cache: 0},
			{path: filename1, url: '/one', cache: 300},
			{path: filename2, url: '/two', cache: 301},
		]);
		setTimeout(done, 500); // Give it time to load the files
	});

	it('should have type css', function(done) {
		request('GET', '/one', {}, function(res) {
			assert.equal(parseInt(res.headers['content-length']), CONTENT1.length);
			assert.equal(res.headers['content-type'], 'text/plain');
			assert.equal(res.body.length, Buffer.byteLength(CONTENT1));
			assert.equal(res.headers['cache-control'], 'max-age=300');
			done();
		});
	});
	it('should have type text', function(done) {
		request('GET', '/two', {}, function(res) {
			assert.equal(parseInt(res.headers['content-length']), CONTENT2.length);
			assert.equal(res.headers['content-type'], 'text/css');
			assert.equal(res.body.length, Buffer.byteLength(CONTENT2));
			assert.equal(res.headers['cache-control'], 'max-age=301');
			done();
		});
	});
	
	it('should have the first content set', function(done) {
		request('GET', '/', {}, function(res) {
			assert.equal(parseInt(res.headers['content-length']), CONTENT1.length);
			assert.equal(res.headers['content-type'], 'text/plain');
			assert.equal(res.body.length, Buffer.byteLength(CONTENT1));
			assert.equal(res.headers['cache-control'], undefined);
			done();
		});
	});
	
	it('should get the new file contents after we change them', function(done) {
		fs.writeFileSync(testfile, CONTENT2);
		setTimeout(function() { // Time to load the new one
			request('GET', '/', {}, function(res) {
				assert.equal(parseInt(res.headers['content-length']), CONTENT2.length);
				assert.equal(res.headers['content-type'], 'text/plain');
				assert.equal(res.body.length, Buffer.byteLength(CONTENT2));
				etag = res.headers['etag'];
				done();
			});
		}, 50);
	});
	
	it('should send compressed contents if supported', function(done) {
		request('GET', '/', {'accept-encoding': 'gzip'}, function(res) {
			assert.equal(res.headers['content-encoding'], 'gzip');
			assert.equal(parseInt(res.headers['content-length']), res.body.length);
			assert.equal(res.headers['content-type'], 'text/plain');
			require('zlib').gzip(CONTENT2, function(err, compressed) {
				assert.equal(res.body.length, compressed.length);
				done();
			});
		});
	});
	
	it('should respond to if-modified-since', function(done) {
		request('GET', '/', {'if-modified-since': new Date(Date.now() + 50000).toGMTString()}, function(res) {
			assert.equal(res.statusCode, 304);
			assert.equal(res.body, undefined);
			done();
		});
	});
	
	it('should respond to if-none-match', function(done) {
		request('GET', '/', {'if-none-match': etag}, function(res) {
			assert.equal(res.statusCode, 304);
			assert.equal(res.body, undefined);
			done();
		});
	});
	
	it('should not include a body for a HEAD request', function(done) {
		request('HEAD', '/', {}, function(res) {
			assert.equal(res.statusCode, 200);
			assert.equal(res.body, undefined);
			assert.equal(parseInt(res.headers['content-length']), CONTENT2.length);
			assert.equal(res.headers['content-type'], 'text/plain');
			assert.equal(res.headers['etag'], etag);
			done();
		});
	});
	
	it('should give a 405 on other methods', function(done) {
		request('POST', '/', {}, function(res) {
			assert.equal(res.statusCode, 405);
			done();
		});
	});
	
	it('should return 404 if we delete the file', function(done) {
		fs.unlinkSync(testfile);
		setTimeout(function() { // Time to update
			request('GET', '/', {}, function(res) {
				assert.equal(res.statusCode, 404);
				done();
			});
		}, 100);
	});
});
