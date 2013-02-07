var http       = require("http"),
    express    = require("express"),
    _          = require('underscore'),
    app        = express(),
    file_root  = __dirname + "/../../htdocs/",
    DEST_HOST  = process.argv.length > 2 ? process.argv[2] : "www.qa-dest.imprev.net",
    DEST_VHOST = process.argv.length > 3 ? process.argv[3] : DEST_HOST;

var serve_static = function(file_name, response) {
    response.sendfile(file_name, {
        "root": file_root
    }); 
};

var proxy_request = function(request, response, root, filepath, data) {
    var q    = require('url').parse(request.url).query,
        url  = "http://" + DEST_HOST + "/" + root + "/" + filepath,
        path = ("/" + root + "/" + filepath) + (q ? "?" + q : ""),
        send_headers,
        proxy_req;

    send_headers      = _.clone(request.headers);
    send_headers.host = DEST_VHOST; // for virtual host resolution on target
    if (!data) delete send_headers["content-length"]
    
    proxy_req = http.request({
        "hostname": DEST_HOST,
        "port"    : 80,
        "path"    : path,
        "headers" : send_headers,
        "method"  : request.method
    }, function(proxy_res) {
        _.each(proxy_res.headers, function(v, k) {
            if (k === "set-cookie") {
                _.each(_.first(v).split(","), function(cookie) {
                    cookie = cookie.replace(new RegExp("( Domain=[\\w\\.-]+;?)"), "");
                    cookie = cookie.replace(new RegExp("( Path=[\\w\\.-/]+)"), "");
                    response.setHeader(k, cookie);
                });
            }
            else if (k === "content-encoding") {
                response.setHeader(k, _.first(v));
            }
        });

        response.setHeader("content-type", proxy_res.headers["content-type"]);

        proxy_res.on("data", function(chunk) {
            response.write(chunk);
        });

        proxy_res.on("end", function() {
            response.end();
        });
    });

    if (data) {    
        proxy_req.write(JSON.stringify(data));
    }

    proxy_req.end();
};

app.use(express.bodyParser());

app.get("/", function(req, res) {
    serve_static("index.html", res);
});

app.get("/demo", function(req, res) {
    serve_static("index.html", res);
});

app.get("/qunit", function(req, res) {
    serve_static("qunit.html", res);
});

app.get("/omc/*", function(req, res) {
    proxy_request(req, res, "omc", req.params[0]);
});

app.get("/designs/*", function(req, res) {
    proxy_request(req, res, "designs", req.params[0]);
});

app.get("/tmp/*", function(req, res) {
    proxy_request(req, res, "tmp", req.params[0]);
});

app.get("/*", function(req, res) {
    serve_static(req.params[0], res);
});

app.post("/omc/*", function(req, res) {
    proxy_request(req, res, "omc", req.params[0], req.body);
});

app.listen(8080);

console.log("Proxying /omc/ requests to: " + DEST_HOST); 
