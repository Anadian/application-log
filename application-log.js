#!/usr/local/bin/node

/**
* @file application-log.js
* @brief A slightly-opinionated, fairly-robust, and comparatively-simple logging solution for applications and simple commands.
* @author Anadian
* @copyright 	Copyright 2019 Canosw
	Permission is hereby granted, free of charge, to any person obtaining a copy of this 
software and associated documentation files (the "Software"), to deal in the Software 
without restriction, including without limitation the rights to use, copy, modify, 
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject to the following 
conditions:
	The above copyright notice and this permission notice shall be included in all copies 
or substantial portions of the Software.
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT 
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE 
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

//Dependencies
	//Internal
	//Standard
	const Utility = require('util');
	const FileSystem = require('fs');
	const Path = require('path');
	//External
	const EnvPaths = require('env-paths');
	const Chalk = require('chalk');
	const StripJSONComments = require('strip-json-comments');
	const ParseJSON = require('parse-json');

//Constants
const FILENAME = 'application-log.js';
const MODULE_NAME = 'ApplicationLog';
var PROCESS_NAME = '';
if(require.main === module){
	PROCESS_NAME = 'application-log';
} else{
	PROCESS_NAME = process.argv0;
}
const EnvironmentPaths = new EnvPaths(PROCESS_NAME);

var date = new Date();
const LogLevelsMap = new Map([ //RFC 5424
	['emerg', 0],
	['alert', 1],
	['crit', 2],
	['error', 3],
	['warn', 4],
	['note', 5],
	['info', 6],
	['debug', 7]
]);
const TransportTypesMap = new Map([
	['directory', 0],
	['file', 1],
	['stream', 2],
	['callback', 3]
]);

var Metadata = {
	absolute_path: Path.join( EnvironmentPaths.log, '.log_information.json'),
	access_okay: false
};
var Transports = [
	{enabled: true, type: 'directory', level: 'debug', name: 'log_debug', directory: EnvironmentPaths.log, header: true, cycle_size: 1048576, file_limit: 4, colour: false, callback: null, metadata_file: 'log_information.json' },
//	{enabled: true, type: 'file', name: date.toISOString().replace(/[-+:.]/g,'')+'.log', colour: false, level: 'debug'},
//	{enabled: true, type: 'stream', name: 'stderr', colour: true, level: 'info'}
];

var CyclicalLogState = {
	current_index: 1, //The value appended to the currently-used log file.
	file_count: 4, //The number of "tracked" log files including the current log file.
	current_size: 0 //The size of the currently-used log file; when this is greater than max_size, switch to a new log file.
};
//Functions
/**
* @fn ApplicationLog_LogDirectory_WriteCheck
* @brief Checks if the given directory exists and is writable.
* @param log_directory
*	@type String
*	@brief The directory to be write-checked.
*	@default null
* @return <ARRAY>
*	@entry 0 
*		@retval 1 premature return.
*		@retval 0 on success.
*		@retval <0 on failure.
*	@entry 1
*		@retval <object> on success
*		@retval <error_message> on failure.
*/
function ApplicationLog_LogDirectory_WriteCheck( log_directory ){
	var _return = [1,null];
	const FUNCTION_NAME = 'ApplicationLog_LogDirectory_WriteCheck';
	//Variables
	var function_return = [1,null];

	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','received: '+arguments.toString());
	//Parametre checks
	if(log_directory == undefined) log_directory = null;
	
	//Function
	if( log_directory != null && typeof(log_directory) === 'string' ){
		try{
			FileSystem.existsSync( log_directory );
			function_return[0] = 0;
		} catch(error){
			function_return = [-3,error];
		}
		if( function_return[0] === 0 ){ //log_directory exists
			try{
				FileSystem.accessSync( log_directory, FileSystem.constants.W_OK | FileSystem.X_OK );
				function_return[0] = 0;
			} catch(error){
				function_return = [-4,error];
			}
			if( function_return[0] === 0 ){ //Write check affirmative.
				_return = [0,null];
			} else{ //Write check failure.
				_return = [function_return[0], 'Error: write check failed with the given error: '+function_return[1]];
			}
		} else{ //log_directory does not exist
			_return =[function_return[0], 'Error: the given log_directory does not exist: '+function_return[1]];
		}
	} else{
		_return = [-2,'Error: argument log_directory is invalid: it should be a non-empty string; the value given is either empty or not a string: '+log_directory];
	}

	//Return
	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','returned: '+_return.toString());
	return _return;
}
/**
* @fn ApplicationLog_Metadate_Infer
* @brief Derives metadata information from the current state on the log directory; in essence, makes a new 'log_information.json' metadata file when it's not present or invalidly formatted.
* @param log_drectory
*	@type String
*	@brief The directory to be read for the inferring the metadata state.
*	@default null
* @return <ARRAY>
*	@entry 0 
*		@retval 1 premature return.
*		@retval 0 on success.
*		@retval <0 on failure.
*	@entry 1
*		@retval <object> on success
*		@retval <error_message> on failure.
*/
function ApplicationLog_Metadate_Infer( log_drectory ){
	var _return = [1,null];
	const FUNCTION_NAME = 'ApplicationLog_Metadate_Infer';
	//Variables

	Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','received: '+arguments.toString());
	//Parametre checks
	if(log_drectory == undefined) log_drectory = null;
	
	//Function
			function_return = ApplicationLog_Directory_WriteCheck(log_directory);
			if( function_return[0] === -3 ){
				try{
					FileSystem.mkdirSync( log_directory, {recursive: true} );
					function_return = [0,null];
				} catch(error){
					function_return = [-3,'Error: FileSystem.mkdirSync failed with this error: '+error];
				}	
			}
			if( function_return[0] === 0 ){
				try{
					function_return[1] = FileSystem.readdirSync( log_directory, {encoding: 'utf8', withFileTypes: true} );
					function_return[0] = 0;
				} catch(error){
					function_return = [-4,'Error: FileSystem.readdirSync threw this error: '+error];
				}
				if( function_return[0] === 0 ){
					files = function_return[1];
					transport_state.match_regex = new RegExp(transport_state.base_filename+'(\\d+).log');
					for(var i = 0; i < files.length; i++){
						match_result = files[i].match(transport_state.match_regex);
						if( match_result !== null ){
							var index_int = parseInt(match_result[1],10);
							if( Number.isNaN(index_int) === false ){
								if( index_int >= transport_state.current_index ){
									transport_state.current_index = index_int;
								}
							}
						}
					}
				}
			}

	//Return
	Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','returned: '+_return.toString());
	return _return;
}

/**
* @fn ApplicationLog_CycleBusiness
* @brief Returns the appropriate file to log to, shifting and removing old files as necessary.
* @param transport_index
*	@type Number
*	@brief The index of the transport to be updated.
*	@default null
* @return <ARRAY>
*	@entry 0 
*		@retval 1 premature return.
*		@retval 0 on success.
*		@retval <0 on failure.
*	@entry 1
*		@retval <object> on success
*		@retval <error_message> on failure.
*/
function ApplicationLog_CycleBusiness( transport_index ){
	var _return = [1,null];
	const FUNCTION_NAME = 'ApplicationLog_CycleBusiness';
	//Variables
	var tracked_file_index;
	var current_file_stats;
	var date;
	var header;

	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','received: '+arguments.toString());
	//Parametre checks
	if(transport_index == undefined) transport_index = null;
	
	//Function
	if( transport_index != null ){
		tracked_file_index = (Transports[transport_index].tracked_files.length-1);
		current_file_stats = FileSystem.statSync( Path.join(Transports[transport_index].log_directory, Transports[transport_index].tracked_files[tracked_file_index].filename) );
		Transports[transport_index].tracked_files[tracked_file_index].size = current_file_stats.size;
		Transports[transport_index].tracked_files[tracked_file_index].last_write = current_file_stats.mtime;
		if( Transports[transport_index].tracked_files[tracked_file_index].size >= Transports[transport_index].cycle_size ){
			if( Transports[transport_index].tracked_files.length >= Transports[transport_index].file_limit ){
				Transports[transport_index].tracked_files.shift();
				tracked_file_index = (Transports[transport_index].tracked_files.length-1);
			}
			date = new Date();
			new_tracked_file = {
				filename: Transports[transport_index].name+(Transports[transport_index].tracked_files[tracked_file_index].index+1)+'.log',
				created: date.toISOString(),
				last_write: date.toISOString(),
				size: 0,
				index: (Transports[transport_index].tracked_files[tracked_files_index].index+1)
			};
			Transports[transport_index].tracked_files.push(new_tracked_file);
			if( Transports[transport_index].header === true ){
				header = Utility.format("#Header\n%o\n%o\n",Transports[transport_index].tracked_files[(Transports[transport_index].tracked_files.length - 1)], Transports[transport_index]);
				FileSystem.appendFileSync( Path.join(Transports[transport_index].log_directory,Transports[transport_index].tracked_files[(Transports[transport_index].tracked_files.length - 1)].filename), header, 'utf8');
			}
		}
		_return = [0, Path.join(Transports[transport_index].log_directory,Transports[transport_index].tracked_files[(Transports[transport_index].tracked_files.length - 1)])];
	} else{ //transport_index is null
		_return = [-2,'Error: parameter invalid; transport_index needs to a non-null number.']
	}

	//Return
	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','returned: '+_return.toString());
	return _return;
}

/**
* @fn ApplicationLog_Transports_Add
* @brief Add a transport.
* @param enabled
*	@type Boolean
*	@brief A boolean determining whether the new transport is to be enabled immediately.
*	@default true
* @param type
*	@type TransportType:String
*	@brief The type of transport: 'directory', 'file', 'stream', or 'callback'
*	@default 'file'
* @param level
*	@type LogLevel:String
*	@brief The log level of the transport.
*	@default 'debug'
* @param name
*	@type String
*	@brief [directory] The base-filename, minus the file-extension, which will be concatenated to form the names of the incremental, cyclical log files. [file] The name of the transport file. [stream] A value of 'stdout' or 'stderr' will write to their respective POSIX-standard streams.
*	@default null
* @param log_directory
*	@type String
*	@brief [directory/file] Where the log file(s) will be stored.
*	@default EnvironmentPaths.log
* @param header
*	@type Boolean
*	@brief [file] Whether a header should be added when the tranport is first being used.
*	@default true
* @param cycle_size
*	@type Number
*	@brief [file] The size, in bytes, at which to cycle to the next file; default is 1 048 576 bytes (1 MiB).
*	@default 1048576
* @param file_limit
*	@type Number
*	@brief [file] The max number of log files to have in the directory at once; default is 4.
*	@default 4
* @param colour
*	@type Boolean
*	@brief [stream] Whether to use colour when writing to a stream.
*	@default true
* @param callback
*	@type Function
*	@brief [callback] The function to be called with all the message information.
*	@default null
* @return <ARRAY>
*	@entry 0 
*		@retval 1 premature return.
*		@retval 0 on success.
*		@retval <0 on failure.
*	@entry 1
*		@retval <object> on success
*		@retval <error_message> on failure.
*/
function ApplicationLog_Transports_Add( enabled, type, level, name, log_directory, header, cycle_size, file_limit, colour, callback ){
	var _return = [1,null];
	const FUNCTION_NAME = 'ApplicationLog_Transports_Add';
	//Variables
	var function_return = null;
	var tracked_files = [];
	var match_result = null;
	var files = null;

	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','received: '+arguments.toString());
	//Parametre checks
	if(enabled == undefined) enabled = true;
	if(type == undefined) type = 'file';
	if(level == undefined) level = 'debug';
	if(name == undefined) name = 'log_debug';
	if(log_directory == undefined) log_directory = EnvironmentPaths.log;
	if(header == undefined) header = true;
	if(cycle_size == undefined) cycle_size = 1048576;
	if(file_limit == undefined) file_limit = 4;
	if(colour == undefined) colour = true;
	if(callback == undefined) callback = null;
	
	//Function
	switch(type){
		case 'directory':
			//Add directory transport
			tracked_files = [],
			f\r = ApplicationLog_LogDirectory_WriteCheck(log_directory);
			if( f\r[0] === 0 ){
				log_information_data = FileSystem.readFileSync(Path.join(log_directory,'log_information.json'), 'utf8');
				if( log_information_data != null ){
					log_information_data_stripped = StripJSONComments(log_information_data);
					if( log_information_date != null ){
						log_information_object = ParseJSON(log_information_data_stripped);
						if( log_information_object != null ){
							transport_state = log_information_object;
						} else{
							console.error('Error parsing "log_information.json"');
						}
					} else{
						console.error('Error stripping comments from "log_information.json"');
					}
				} else{
					console.error('Error reading "log_information.json"');
				}
				transport = {
					enabled: enabled,
					type: 'directory',
					level: level,
					name: name,
					log_directory: log_directory,
					header: header,
					cycle_size: cycle_size,
					file_limit: file_limit,
					tracked_files: transport_state,
				}
				Transports.push(transport);
			} else{
				_return = f\r;
			}
			break;
		case 'file':
			//Add file transport
			break;
		case 'stream':
			//Add stream transport
			break;
		case 'callback':
			//Add callback transport
			break;
		default:
			_return = [-3,'Transport type invalid.'];
	}

	//Return
	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','returned: '+_return.toString());
	return _return;
}


function appendFile_Callback(error){ 
	if(error != null) console.error('AppendFile error: ', error);
}

function ReturnObject(code, message){
	var return_message = code.toString()+': '+message;
	if(arguments.length > 2){
		for(var i = 2; i < arguments.length; i++){
			return_message += ('|'+Utility.inspect(arguments[i]));
		}
	}
	return [code,return_message];
}

function Log(process_name, module_name, file_name, function_name, level_name, message){
	var _return = [0,null];
	var error_message = null;
	var date = new Date();
	if(arguments.length > 6){
		for(var i = 6; i < arguments.length; i++){
			message += ('|'+Utility.inspect(arguments[i]));
		}
	}
	for(var i = 0; i < Transports.length; i++){
		if(Transports[i].enabled === true){
			var transport_level = LogLevelsMap.get(Transports[i].level);
			var message_level = LogLevelsMap.get(level_name);
			if(message_level <= transport_level){
				if(Transports[i].type === 'directory'){
					target_log_file = Path.join(Transports[i].log_directory, (Transports[i].state.file_basename+Transports[i].state.current_index+'.log'));
					message = date.toISOString()+' '+process_name+':'+module_name+':'+file_name+':'+function_name+':'+level_name+': '+message+'\n';
					if( Transports[i].state.current_size < Transports[i].max_size ){
						FileSystem.appendFile(target_log_file, message, 'utf8', appendFile_Callback);
						FileSystem.lstat(target_log_file, null, lstat_Callback);
						_return[0] = 0;
					} else{
						if( Transports[i].state.current_files >== Transports[i].max_files ){
							FileSystem.unlink(

				} else if(Transports[i].type === 'file'){
					if(Transports[i].name != null){
						FileSystem.appendFile(Transports[i].name, date.toISOString()+' '+process_name+':'+module_name+':'+file_name+':'+function_name+':'+level_name+': '+message+'\n', 'utf8', appendFile_Callback);
						_return[0] = 1;
					} else{
						error_message = Utility.format('Log error: Transports[%d].name is not specified: ', i, Transports[i].name);
						console.error(error_message);
						_return[0] = 0;
						_return[1] += error_message;
					}
				} else if(Transports[i].type === 'stream'){
					var string = '';
					if(Transports[i].colour === true){
						var colour;
						switch(level_name){
							//silent
							case 'error': colour = Chalk.red; break;
							//quiet
							case 'warn': colour = Chalk.yellow; break;
							case 'note': colour = Chalk.magenta; break;
							case 'info': colour = Chalk.blue; break;
							//normal
							case 'debug': colour = Chalk.green; break;
							//verbose
							default: colour = function no_colour(){ return arguments; }; break;
						}
						string = colour(Utility.format("%s:%s:%s: %s", Chalk.bold(level_name), Chalk.dim(module_name), Chalk.underline(function_name), message));
					} else{
						string = Utility.format("%s:%s:%s: %s", level_name, module_name, function_name, message);
					}
					if(Transports[i].name === 'stdout'){
						console.log(string);
						_return[0] = 1;
					} else if(Transports[i].name === 'stderr'){
						console.error(string);
						_return[0] = 1;
					} else{
						error_message = Utility.format('Log error: Unknown stream for Transports[%d]: %s', i, Transports[i].name);
						console.error(error_message);
						_return[0] = 0;
						_return[1] += error_message;
					}
				} else{
					error_message = Utility.format('Log error: Invalid transport type for Transports[%d]: '. i, Transports.type);
					console.error(error_message);
					_return[0] = 0;
					_return[1] += error_message;
				}	
			}
		}
	}
	return _return;
}
function Log_Test(){
	Log(process.argv0, 'test', Path.basename(__filename), arguments.callee.name, 'error', 'yo');
	Log(process.argv0, 'test', Path.basename(__filename), arguments.callee.name, 'warn', 'yo');
	Log(process.argv0, 'test', Path.basename(__filename), arguments.callee.name, 'note', 'yo');
	Log(process.argv0, 'test', Path.basename(__filename), arguments.callee.name, 'info', 'yo');
	Log(process.argv0, 'test', Path.basename(__filename), arguments.callee.name, 'debug', 'yo');
}

//Exports and Execution
if(require.main === module){
	Log_Test();
} else{
	exports.log = Log;
	exports.test = Log_Test;
}
