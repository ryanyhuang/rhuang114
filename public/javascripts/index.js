//socket connection
var socket = io.connect('https://rhuang114.herokuapp.com');

//sets starting directory to the resume folder
var curDir = "resume";
var cds = ['cd resume'];

//array that will contain all the commands entered
//recorded so users can use up and down arrow keys to scroll through them
var allCommands = [];
var comIndex = 0;
var tempCom = false;

//commands that could compromise server so they were disabled
var disabledComs = ['rm', 'mv', 'cp', 'rmdir', 'touch', 'mkdir', 'kill', 'chmod', 'node'];

//handles actions like clicking and pressing certain buttons
$(document).ready(function() {
	//focus on the prompt when the site loads
	document.getElementById("command").focus();
	
	//refocus if someone clicks in the terminal
	$('.terminal').click(function(){
		document.getElementById("command").focus();
	});

	//manage key key commands
	//bound to form so key commands only work when you're in the prompt
	$('form').keydown(function(event){
		var command = document.getElementById('command');
		/* 
		 * autocomplete feature using tab
		 * this is not a smart autocomplete, ie it will complete even if it
		 * shouldn't like if you're trying to complete the first word of a command
		 * (first words shoud always be a command so it shouldn't autocomplete to
		 * a file or directory name). It also does nothing for words that start with
		 * the same substring (in your standard terminal it will fill out the shared
		 * substring). Lastly it does not work beyond cd directorys, so entering
		 * cd resume/te + [tab] will do nothing. It does have the basic functionality
		 * of autocompleting long words though.
		 */
		if(event.keyCode == 9){
			event.preventDefault();
			/* 
			 * sends the backend the current directory and what is currently entered
			 * in the prompt. the backend will compare each item in the current
			 * directory with what is in the prompt and fill out the prompt if
			 * there is a matching word.
			 */
			socket.emit('tabPressed', 
				{lsCom: (cds.join(' && ') + ' && ls'),
				curCom: command.value},
				function(newString){
					command.value = newString;
				});
		}
		/* 
		 * handling pressing enter to submit command
		 * overwrites normal enter in form actions and calls commandEntered
		 * which does most of the command processing
		 */
		if(event.keyCode == 13) {
			if(tempCom) allCommands.pop();
			//prevents page from refreshing
  			event.preventDefault();
  			//calls processing command
  			commandEntered();
  			return false;
		}
		/*
		 * handles pressing up arrow key
		 */
		if(event.keyCode == 38){
			//records what is currently in prompt if needed
			if(comIndex == allCommands.length){
				allCommands.push(command.value);
				tempCom = true;
			}
			//displays previous command
			if(typeof allCommands[comIndex - 1] != 'undefined'){
				comIndex--;
				command.value = allCommands[comIndex];
			}
		}
		/*
		 * handles pressing down arrow key
		 */
		if(event.keyCode == 40){
			//displays next command in array of commands
			if(typeof allCommands[comIndex + 1] != 'undefined'){
				comIndex++;
				command.value = allCommands[comIndex];
			}
			
			//removes the temp command that was pushed onto the array when up
			//was first pressed
			if(comIndex+1 == allCommands.length){
				allCommands.pop();
				tempCom = false;
			}
		}
	});
});

/*
 * when a command is entered, a couple things need to happen
 * 1. command needs to appear in console
 * 2. stdout of command needs to appear
 * 3. text area needs to be cleared
 * 4. prompt may need to be changed
 * 5. affects of command need to be recorded
 */
var commandEntered = function(){
	var command = document.getElementById('command');
	//create prompt
	var prompt = "Ryans-Website:" + curDir + " guest$ ";

	//record what was entered and append it to terminal
	var text = prompt + command.value;
	appendLine(text);

	//save command push it onto array of all the commands entered
	var savedCommand = command.value;
	allCommands.push(savedCommand);
	comIndex = allCommands.length;
	console.table(allCommands);

	//CHECKS FOR SPECIAL COMMANDS TO BE DISABLED OR HANDLED SPECIALLY.

	//help and about work specially where they just display frontloaded text
	if(command.value == "help" || command.value == "about"){
		var file = helpText;
		if(command.value == "about") file = aboutText;
		var output = file.split('\n');
		for(var i = 0; i < output.length; i++){
			appendLine(output[i]);
		}
		command.value = '';
		return;
	}
	
	//these symbols were disabled because they could compromise the site
	//or just wouldn't work
	if(savedCommand.indexOf('<') != -1 ||
		savedCommand.indexOf('>') != -1 ||
		savedCommand.indexOf('&') != -1){
		appendLine('Error: disabled character used. Enter \"help\" for more information');
		command.value = '';
		return;
	}

	//these commands were disabled because they could compromise the site
	if(disabledComs.indexOf(savedCommand.split(' ')[0]) != -1){
		if(/*savedCommand.split(' ')[0] == 'touch' && curDir === "guestbook"*/ false){
			//honestly no idea why this isn't working
		} else {
			appendLine('Error: disabled command used. Enter \"help\" for more information');
			command.value = '';
			return;
		}
	}

	//stuff below results in a socket emit to the backend
	//each socket emit has a callback that changes something in the frontend

	//checks if command is a cd command and applies special
	//treatment to track these
	if(savedCommand.split(' ')[0] == 'cd'){
		console.log('cd command entered');
		//sends the backend the path that is trying to be accessed
		socket.emit('dirCheck', (cds.join(' && ') + ' && ' + savedCommand),
			function(err, out){
				//report if theres an error or not
				if(err){
					console.log('dir nto changed bc not exist');
					appendLine(out);

				} else {
					//if there isn't an error, add to list of cds
					//update prompt to reflect change
					console.log(savedCommand);
					cds.push(savedCommand);
					console.log('dir changed cuz exists');
					prompt = "Ryans-Website:" + out + " guest$ ";
					curDir = out;
					//change prompt to reflect directory changes
					document.getElementById("prompt").innerHTML = prompt;
				}
			});

	//all other types of commands are just sent through
	//can add checking for other commands here
	} else {
		var pathedCommand = cds.join(' && ') + (' && ') + savedCommand;
		console.table(cds);
		console.log(pathedCommand);
		//send command to backend for evaluation
		socket.emit('comEnt', pathedCommand,
			function(out){
				//append output to terminal
				var output = out.split('\n');
				for(var i = 0; i < output.length; i++){
					appendLine(output[i]);
				}
			});
	}
	//clear input
	command.value = '';
	

};

/*
 * forces scroll down to the bottom of the terminal div
 * this was from stack overflow
 */
function scrollDown(){
	var objDiv = document.getElementById("term");
	objDiv.scrollTop = objDiv.scrollHeight;
}

/*
 * appends given text to terminal
 * this was from stack overflow
 */
function appendLine(text){
	var para = document.createElement("div");
	var node = document.createTextNode(text);
	
	para.appendChild(node);
	var element = document.getElementById("console");
	element.appendChild(para);
	scrollDown();
}
//help and about text thats appended when help or about is entered
var helpText = 
	"Commands to navigate this website:\n" +
	"ls: shows the contents of the current directory. Text files end with .txt and "
	+ "folders do not have an extension.\n" +
	"cd: enters folder (ex. \"cd projects\" will make you enter the projects folder). "
	+ "You can see your current directory in the prompt.\n" +
	"cat: will show contents of a text file when used as \"cat file.txt\".\n" +
	"grep: finds instances of a word, like a resume keyword scanner. " + 
	"(ex. grep -i \'java\' skills.txt). The -i option make it case insensitive. " +
	"You can also use the -r option to search a folder. (ex. grep -r web . would search "+
	"every file in the current folder for web).\n" +
	"Other commands that work: echo, date, wc, pwd, ps.\n" +
	"Disabled commands: rm, mv, cp, rmdir, touch, mkdir, kill, chmod, node.\n" +
	"Disabled characters: <, >, &.\n" +
	"Useful tip: Use the tab key to autocomplete file names, and the up and down keys "
	+ "to browse previously entered commands.\n" +
	"Type \"about\" to learn why some commands don't work and some are disabled.\n"
	;

var aboutText = 
	"This website interfaces between your browser and the shell on the Heroku servers. "+
	"It does this by executing the user inputted commands as child processes in the "+
	"server’s backend, and sending the output back to the clientside. Therefore, this "+
	"website has almost all of the functionality of UNIX, without individually "+
	"implementing each command and its options. However, child processes spawn in their "+
	"own shells, so some functionality is lost. For instance, cd wouldn’t work because "+
	"each new shell starts in the root directory, so I implemented it manually by "+
	"storing all cd commands entered in the user’s frontend, and placing them in front "+
	"of each new command. Commands that require stdin won't work, too. I also had to disable a lot of commands, because they could "+
	"alter the server structure or create spam files. To see the code for yourself, use "+
	"cd ~. The backend is a simple node.js express app. If you have any questions, you can "+
	"email me at ryh002@ucsd.edu."
	;









