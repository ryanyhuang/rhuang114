//express default setup stuff==============================
var express = require('express');
var path = require('path');
var http = require('http');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.engine('jade', require('jade').__express);
app.use(express.static(path.join(__dirname, 'public')));

app.get("/", function(req, res){
    res.render("index");
});

//=========================================================

var server = http.createServer(app);
var io = require('socket.io').listen(server);

const exec = require('child_process').exec;

//sockets listening
io.sockets.on('connection', function(socket){
	console.log('user connected');

	/*
	 * when a commanded is entered, execute it as a child process
	 * analyze whether it gave an error or not and send back the output
	 */
	socket.on('comEnt', function(data, fn){
		
		exec(data, (error, stdout, stderr) => {
			if (error) {
			 	var err = (`${error}`).split('\n')[1].replace("/bin/sh", "-bash");
		    	fn(err);
		    	return;
		    } else {
		    	fn(stdout);
		    }
		    
		});
	})

	/*
	 * when someone tries to cd somewhere, check to see if the directory exists
	 * by executing the cd chain and pwd. If it doesn't exist it will give an
	 * error, if it does use the output from pwd to get the new directory (can't
	 * take directly from command entered because cd .. doesnt make the directory
	 * ..). reflect appropriate changes with callback function from frontend
	 */
	socket.on('dirCheck', function(data, fn){
		exec(data + ' && pwd', (error, stdout, stderr) => {
			if(error){
				var err = '-bash: cd:' + 
					((`${error}`).split('\n')[1]).split(':').slice(3).join(':');
				console.log(err);
				fn(true, err)
			} else {
				var dirToken = stdout.split('/');
				var dir = dirToken[(dirToken.length-1)];
				fn(false, dir);
				console.log(dir);
			}
			
		});
	})

	/*
	 * the data received here consists of an ls command the current command
	 * in the prompt. the ls command scouts out the directory then compares
	 * it to the current command
	 */
	socket.on('tabPressed', function(data, fn){
		console.log(data);
		//tokenize current command. we only want to work with the last word
		//thats being typed, so pop it off and store it in tabbedOn
		var tokenCom = data.curCom.split(' ');
		var tabbedOn = tokenCom.pop();

		var files;
		//generate list of files in the directory
		exec(data.lsCom, (error, stdout, stderr) => {
			files = stdout.split('\n');
			tabWork();
		});

		/*
		 * made this a seperate function because asynchronous stuff was hurting my head
		 * compares the word currently being typed to every file in the directory
		 */
		var tabWork = function(){
			//records # of matches
			var matches = 0;
			//records newcom if theres a match
			var newCom;

			//iterate through the directory names and look for files that start
			//with the currently typed command
			for(var i = 0; i < files.length; i++){
				if(files[i].indexOf(tabbedOn) == 0){
					matches++;
					newCom = files[i];
				}
			}

			//if theres only one match then push this word back onto the tokenized
			//version of the command and combines em and uses the callback function
			//to set the prompt
			if(matches == 1){
				tokenCom.push(newCom);
				var repCom = tokenCom.join(' ');
				fn(repCom);
			}
		}
	})

});


server.listen(process.env.PORT || 3000);


module.exports = app;
