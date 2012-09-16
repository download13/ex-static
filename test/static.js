var static = require('../static');
var http = require('http');
var fs = require('fs');
var moka = require('moka');
var describe = moka.describe;
var expect = require('expect.js');

var filename = require('path').join(__dirname, 'testfile.txt');
var CONTENT1 = '3k24jkl 3k24jkl 3k24jkl 3k24jkl';
var CONTENT2 = 'kljkljdaslfjdi3qj4j32kl4j2kljflkfaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
fs.writeFileSync(filename, CONTENT1);

var files;
function request(method, path, headers, cb) {
	var req = {
		method: method,
		url: path,
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

describe('ex-static', function(it, before) {
	var etag;
	before(function(done) {
		files = static([{path: filename, url: '/', cache: 300}]);
		setTimeout(done, 500); // Give it time to load the files
	});
	
	it('should have the first content set', function(done) {
		request('GET', '/', {}, function(res) {
			expect(parseInt(res.headers['content-length'])).to.be(CONTENT1.length);
			expect(res.headers['content-type']).to.be('text/plain');
			expect(res.body.length).to.be(Buffer.byteLength(CONTENT1));
			expect(res.headers['cache-control']).to.be('max-age=300');
			done();
		});
	});
	
	it('should get the new file contents after we change them', function(done) {
		fs.writeFileSync(filename, CONTENT2);
		setTimeout(function() { // Time to load the new one
			request('GET', '/', {}, function(res) {
				expect(parseInt(res.headers['content-length'])).to.be(CONTENT2.length);
				expect(res.headers['content-type']).to.be('text/plain');
				expect(res.body.length).to.be(Buffer.byteLength(CONTENT2));
				etag = res.headers['etag'];
				done();
			});
		}, 100);
	});
	
	it('should send compressed contents if supported', function(done) {
		request('GET', '/', {'accept-encoding': 'gzip'}, function(res) {
			expect(res.headers['content-encoding']).to.be('gzip');
			expect(parseInt(res.headers['content-length'])).to.be(res.body.length);
			expect(res.headers['content-type']).to.be('text/plain');
			require('zlib').gzip(CONTENT2, function(err, compressed) {
				expect(res.body.length).to.be(compressed.length);
				done();
			});
		});
	});
	
	it('should respond to if-modified-since', function(done) {
		request('GET', '/', {'if-modified-since': new Date(Date.now() + 50000).toGMTString()}, function(res) {
			expect(res.statusCode).to.be(304);
			expect(res.body).to.not.be.ok();
			done();
		});
	});
	
	it('should respond to if-none-match', function(done) {
		request('GET', '/', {'if-none-match': etag}, function(res) {
			expect(res.statusCode).to.be(304);
			expect(res.body).to.not.be.ok();
			done();
		});
	});
	
	it('should not include a body for a HEAD request', function(done) {
		request('HEAD', '/', {}, function(res) {
			expect(res.statusCode).to.be(200);
			expect(res.body).to.not.be.ok();
			expect(parseInt(res.headers['content-length'])).to.be(CONTENT2.length);
			expect(res.headers['content-type']).to.be('text/plain');
			expect(res.headers['etag']).to.be(etag);
			done();
		});
	});
	
	it('should give a 405 on other methods', function(done) {
		request('POST', '/', {}, function(res) {
			expect(res.statusCode).to.be(405);
			expect(res.body).to.not.be.ok();
			done();
		});
	});
	
	it('should return 404 if we delete the file', function(done) {
		fs.unlinkSync(filename);
		setTimeout(function() { // Time to update
			request('GET', '/', {}, function(res) {
				expect(res.statusCode).to.be(404);
				done();
			});
		}, 100);
	});
});

moka.run({parallel: false});