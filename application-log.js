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
const EnvironmentPaths = EnvPaths(PROCESS_NAME);

//var date = new Date();
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
	{enabled: true, type: 'directory', level: 'debug', name: 'log_debug', directory: EnvironmentPaths.log, header: true, cycle_size: 1048576, file_limit: 4, colour: false, callback: null, metadata_file: 'log_information.json', tracked_files: []},
//	{enabled: true, type: 'file', name: date.toISOString().replace(/[-+:.]/g,'')+'.log', colour: false, level: 'debug'},
	{enabled: true, type: 'stream', name: 'stderr', colour: true, level: 'info'}
];

//Functions
function FileIO_Callback(error){ 
	if(error != null) console.error('FileIO_Callback error: ', error);
}
/**
* @fn ApplicationLog_TrackedFile_Stat
* @brief Stats the tracked file of a transport, updating the arrary.
* @param transport_index
*	@type Number
*	@brief The index of the transport.
*	@default null
* @param tracked_file_index
*	@type Number
*	@brief The index of the tracked file to be stat'd.
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
function ApplicationLog_TrackedFile_Stat( transport_index, tracked_file_index ){
	var _return = [1,null];
	var function_return = [1,null];
	const FUNCTION_NAME = 'ApplicationLog_TrackedFile_Stat';
	//Variables

	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','received: '+arguments.toString());
	//Parametre checks
	if(transport_index == undefined) transport_index = null;
	if(tracked_file_index == undefined) tracked_file_index = null;
	
	//Function
	if( transport_index != null && typeof(transport_index) === 'number' && transport_index < Transports.length ){
		if( tracked_file_index != null && typeof(tracked_file_index) === 'number' && tracked_file_index < Transports[transport_index].tracked_files[tracked_file_index] ){
			var file_path = Path.join( Transports[transport_index].directory, Transports[transport_index].tracked_files[tracked_file_index].filename );
			var filestats = null;
			try{
				filestats = FileSystem.statSync(file_path);
				Transports[transport_index].tracked_files[tracked_file_index].size = filestats.size;
				Transports[transport_index].tracked_files[tracked_file_index].last_write = filestats.mtime.toISOString();
				function_return = ApplicationLog_LogMetadata_Write();
				if( function_return[0] === 0 ){
					_return = [0,filestats];
				} else{
					_return = [function_return[0], 'ApplicationLog_LogMetadata_Write: '+function_return[1]];
				}
			} catch(error){
				_return [-4, Utility.format('Error: calling FileSystem.statSync threw error: %s', error)];
			}
		} else{
			_return = [-3, Utility.format('Error: tracked_file_index is either null, not a number, or not a valid tracked_files index: %o', tracked_file_index)];
		}
	} else{
		_return = [-2, Utility.format('Error: transport_index is either null, not a number, or not a valid Transports index: %o', transport_index)];
	}
	//Return
	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','returned: '+_return.toString());
	return _return;
}
/**
* @fn ApplicationLog_TrackedFile_Add
* @brief Adds a new tracked file to transport of the given index.
* @param transport_index
*	@type Number
*	@brief The index of the transport to add a new tracked file to.
*	@default 0
* @return <ARRAY>
*	@entry 0 
*		@retval 1 premature return.
*		@retval 0 on success.
*		@retval <0 on failure.
*	@entry 1
*		@retval <object> on success
*		@retval <error_message> on failure.
*/
function ApplicationLog_TrackedFile_Add( transport_index ){
	var _return = [1,''];
	var function_return = [1,null];
	const FUNCTION_NAME = 'ApplicationLog_TrackedFile_Add';
	//Variables
	var date = new Date();
	var new_tracked_file = {
		filename: '',
		created: date.toISOString(),
		last_write: date.toISOString(),
		size: 0,
		index: null
	};
	var header = '\n';
	var new_tracked_file_index = null;
	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','received: '+arguments.toString());
	//Parametre checks
	if(transport_index == undefined) transport_index = 0;
	
	//Function
	if( Transports[transport_index].tracked_files.length === 0 ){
		new_tracked_file.index = 0;
		new_tracked_file.filename = Transports[transport_index].name + '0.log';
		Transports[transport_index].tracked_files.push(new_tracked_file);
	} else{
		new_tracked_file.index = (Transports[transport_index].tracked_files[(Transports[transport_index].tracked_files.length - 1)].index + 1);
		new_tracked_file.filename = Transports[transport_index].name + (new_tracked_file.index + 1) + '.log';
		if( Transports[transport_index].tracked_files.length >= Transports[transport_index].file_limit ){
			var former_tracked_file = Transports[transport_index].tracked_files.shift();
			var former_tracked_file_path = Path.join(Transports[transport_index].directory, former_tracked_file.filename);
			try{
				FileSystem.unlinkSync( former_tracked_file_path, 'utf8' );
			} catch(error){
				_return = [-8, Utility.format('Warn: error when removing former_tracked_file_path: %s', former_tracked_file_path)];
				console.error(_return[1]);
			}
		}
		new_tracked_file_index = Transports[transport_index].tracked_files.push(new_tracked_file);
	}
	if( Transports[transport_index].header === true ){
		header = Utility.format("#Header\n%o\n%o\n",Transports[transport_index].tracked_files[(Transports[transport_index].tracked_files.length - 1)], Transports[transport_index]);
	}
	var new_tracked_file_path = Path.join(Transports[transport_index].directory,Transports[transport_index].tracked_files[(Transports[transport_index].tracked_files.length - 1)].filename);
	try{
		FileSystem.appendFileSync( new_tracked_file_path, header, 'utf8');
		function_return = ApplicationLog_TrackedFile_Stat( transport_index, new_tracked_file_index );
		if( function_return[0] === 0 ){
			_return = function_return;
		} else{
			_return = [function_return[0], 'ApplicationLog_TrackedFile_Stat: '+function_return[1]];
		}
	} catch(error){
		_return = [-9, Utility.format('Error: writing the header for new_tracked_file_path: %s', new_tracked_file_path)];
		console.error(_return[1]);
	}
	
	//Return
	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','returned: '+_return.toString());
	return _return;
}
/**
* @fn ApplicationLog_Init
* @brief Checks and loads the current log-information metadata file, creating it if necessary.
* @param directory_path
*	@type String
*	@brief The directory to store the log metadata file.
*	@default EnvironmentPaths.log
* @param file_path
*	@type String
*	@brief The name of the log metadata file; defaults to '.log_information.json'
*	@default '.log_information.json'
* @return <ARRAY>
*	@entry 0 
*		@retval 1 premature return.
*		@retval 0 on success.
*		@retval <0 on failure.
*	@entry 1
*		@retval <object> on success
*		@retval <error_message> on failure.
*/
function ApplicationLog_Init( directory_path, file_path ){
	var _return = [1,null];
	const FUNCTION_NAME = 'ApplicationLog_Init';
	
	//Variables
	var directory_accessible = false;
	var file_accessible = false;
	var file_data = null;
	var stripped_file_data = null;
	var json_object = {};

	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','received: '+arguments.toString());
	//Parametre checks
	if(directory_path == undefined) directory_path = EnvironmentPaths.log;
	if(file_path == undefined) file_path = '.log_information.json';
	
	//Function
	try{
		FileSystem.accessSync( directory_path, (FileSystem.constants.F_OK | FileSystem.constants.R_OK | FileSystem.constants.W_OK) );
		directory_accessible = true;
	} catch(error){
		console.error(error);
		try{
			FileSystem.mkdirSync(directory_path, {recursive: true});
			directory_accessible = true;
		} catch(error){
			console.error(error);
			directory_accessible = false;
		}
	}
	if( directory_accessible === true ){
		try{
			FileSystem.accessSync( Path.join(directory_path, file_path), (FileSystem.constants.F_OK | FileSystem.constants.R_OK | FileSystem.constants.W_OK) );
			file_accessible = true;
		} catch(error){
			try{
				FileSystem.writeFileSync( Path.join(directory_path, file_path), '/*.log_information.json: Used by application-log; not intended to be edited by end users.*/\n{\n\ttransports: []\n}', 'utf8');
				file_accessible = true;
			} catch(error){
				console.error(error);
				file_accessible = false;
			}
		}
	} else{
		_return = [-4, 'Directory is inaccessible or could not be created.'];
		file_accessible = false;
	}
	if( file_accessible === true ){
		Metadata.absolute_path = Path.join( directory_path, file_path );
		function_return = ApplicationLog_LogMetadata_Read();
		if( function_return[0] === 0 ){
			for( var i = 0; i < Transports.length; i++){
				if( Transports[i].tracked_files.length == 0 ){
					ApplicationLog_TrackedFile_Add( transport_index );
					ApplicationLog_TrackedFile_Stat( transport_index, tracked_file_index );
				}
			}
		}
		/*file_data = FileSystem.readFileSync( Metadata.absolute_path, 'utf8' );
		if( file_data != null ){
			stripped_file_data = StripJSONComments( file_data );
			if( stripped_file_data != null ){
				console.log('stripped_file_data: %s', stripped_file_data);
				json_object = ParseJSON( stripped_file_data );
				if( json_object.transports != null ){
					Transports = json_object.transports;
					_return = [0,null];
				} 
			} else{
				_return = [-10,Utility.format('Error stripping comments from file_data: %s', file_data)];
			}
		} else{
			_return = [-9,Utility.format('Error reading file: %s', Metadata.absolute_path)];
		}*/
	} else{
		_return = [-8,'Error metadata file is not readable or cannot be created.'];
	}

	//Return
	if( _return[0] !== 0 ){
		console.error(_return);
	}
	return _return;
}
/**
* @fn ApplicationLog_LogMetadata_Read
* @brief Read the '.log_information.json' metadata file if it exists.
* @return <ARRAY>
*	@entry 0 
*		@retval 1 premature return.
*		@retval 0 on success.
*		@retval <0 on failure.
*	@entry 1
*		@retval <object> on success
*		@retval <error_message> on failure.
*/
function ApplicationLog_LogMetadata_Read(){
	var _return = [1,null];
	const FUNCTION_NAME = 'ApplicationLog_LogMetadata_Read';
	//Variables
	var metadata_string = null;
	var stripped_metadata_string = null;
	var metadata_object = null;

	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','received: '+arguments.toString());
	//Parametre checks
	
	//Function
	if( Metadata.absolute_path != null && typeof(Metadata.absolute_path) === 'string' ){
		try{
			metadata_string = FileSystem.readFileSync( Metadata.absolute_path, 'utf8' );
		} catch(error){
			_return = [-8, Utility.format('Error: reading Metadata.absolute_path: %s: %s', Metadata.absolute_path, error)];
		}
		if( _return[0] === -8 ){
			stripped_metadata_string = StripJSONComments( metadata_string );
			if( stripped_metadata_string != null ){
				metadata_object = ParseJSON( stripped_metadata_string );
				if( metadata_object != null ){
					if( Array.isArray(metadata_object.transports) === true ){
						Transports = metadata_object.transports;
					} else{
						_return = [-64, Utility.format('Warn: metadata_object.transports is not an array: %o', metadata_object.transports)];
					}
				} else{
					_return = [-32, Utility.format('Error: parsing stripped_metadata_string: %s', stripped_metadata_string)];
				}
			} else{
				_return = [-16, Utility.format('Error: stripping comments from metadata_string: %s', metadata_string)];
			}
		}
	} else{
		_return = [-4, Utility.format('Warn: Metadata.absolute_path is either null or not a string: %o', Metadata)];
	}

	//Return
	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','returned: '+_return.toString());
	return _return;
}
/**
* @fn ApplicationLog_LogMetadata_Write
* @brief Update the '.log_information.json' metadata file to the current transport state.
* @return <ARRAY>
*	@entry 0 
*		@retval 1 premature return.
*		@retval 0 on success.
*		@retval <0 on failure.
*	@entry 1
*		@retval <object> on success
*		@retval <error_message> on failure.
*/
function ApplicationLog_LogMetadata_Write(){
	var _return = [1,null];
	const FUNCTION_NAME = 'ApplicationLog_LogMetadata_Write';
	//Variables
	var metadata_string = null;

	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','received: '+arguments.toString());
	//Parametre checks
	
	//Function
	if( Metadata.absolute_path != null && typeof(Metadata.absolute_path) === 'string' ){
		metadata_string = JSON.stringify( Transports, null, '\t');
		if( metadata_string != null ){
			FileSystem.writeFile( Metadata.absolute_path, '/*.log_information.json: Metadata file used by application-log; not intended to be directly edited by end users.*/\n'+metadata_string, 'utf8', FileIO_Callback );
			_return = [0,null];
		} else{
			_return = [-8, Utility.format('Error: couldn\'t stringify transports: %o', Transports)];
		}
	} else{
		_return = [-4, Utility.format('Warn: Metadata.absolute_path is either null or not a string: %o', Metadata)];
	}

	//Return
	//Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','returned: '+_return.toString());
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
		if( Transports[transport_index].tracked_files.length < 1 ){
			date = new Date();
			new_tracked_file = {
				filename: Transports[transport_index].name+'0.log',
				created: date.toISOString(),
				last_write: date.toISOString(),
				size: 0,
				index: 0
			};
			Transports[transport_index].tracked_files.push(new_tracked_file);
			if( Transports[transport_index].header === true ){
				header = Utility.format("#Header\n%o\n%o\n",Transports[transport_index].tracked_files[(Transports[transport_index].tracked_files.length - 1)], Transports[transport_index]);
				console.error(Transports[transport_index].directory);
				console.error(Transports[transport_index].tracked_files[0].filename);
				FileSystem.appendFileSync( Path.join(Transports[transport_index].directory,Transports[transport_index].tracked_files[(Transports[transport_index].tracked_files.length - 1)].filename), header, 'utf8');
			}
		}
		tracked_file_index = (Transports[transport_index].tracked_files.length-1);
		current_file_stats = FileSystem.statSync( Path.join(Transports[transport_index].directory, Transports[transport_index].tracked_files[tracked_file_index].filename) );
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
				FileSystem.appendFileSync( Path.join(Transports[transport_index].directory,Transports[transport_index].tracked_files[(Transports[transport_index].tracked_files.length - 1)].filename), header, 'utf8');
			}
		}
		function_return = ApplicationLog_LogMetadata_Write();
		if( function_return[0] === 0 ){
			console.error(Transports[transport_index].directory);
			console.error(Transports[transport_index].tracked_files[(Transports[transport_index].tracked_files.length - 1)]);
			_return = [0, Path.join(Transports[transport_index].directory,Transports[transport_index].tracked_files[(Transports[transport_index].tracked_files.length - 1)].filename)];
		} else{
			_return = [function_return[0], 'ApplicationLog_LogMetadata_Write: '+function_return[1]];
		}
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
			function_return = ApplicationLog_LogDirectory_WriteCheck(log_directory);
			if( function_return[0] === 0 ){
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
				_return = function_return;
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
	var _return = [1,null];
	var error_message = null;
	var function_return = [1,null];
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
					/*target_log_file = Path.join(Transports[i].log_directory, (Transports[i].state.file_basename+Transports[i].state.current_index+'.log'));
					message = date.toISOString()+' '+process_name+':'+module_name+':'+file_name+':'+function_name+':'+level_name+': '+message+'\n';
					if( Transports[i].state.current_size < Transports[i].max_size ){
						FileSystem.appendFile(target_log_file, message, 'utf8', appendFile_Callback);
						FileSystem.lstat(target_log_file, null, lstat_Callback);
						_return[0] = 0;
					} else{
						if( Transports[i].state.current_files >== Transports[i].max_files ){
							FileSystem.unlink(*/
					function_return = ApplicationLog_CycleBusiness( i );
					var target_file = null;
					if( function_return[0] === 0 ){
						target_file = function_return[1];
						FileSystem.appendFile(target_file, date.toISOString()+' '+process_name+': '+module_name+': '+function_name+': '+level_name+': '+message+'\n', 'utf8', FileIO_Callback);
					} else{
						error_message = 'ApplicationLog_Log: '+function_return[1];
						console.error(error_message);
						_return = [function_return[0], error_message];
					}
				} else if(Transports[i].type === 'file'){
					if(Transports[i].name != null){
						FileSystem.appendFile(Transports[i].name, date.toISOString()+' '+process_name+':'+module_name+':'+file_name+':'+function_name+':'+level_name+': '+message+'\n', 'utf8', FileIO_Callback);
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
							case 'emerg':
							case 'alert':
							//silent
							case 'crit':
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
	var function_return = [1,null];
	function_return = ApplicationLog_Init();
	if( function_return[0] !== 0 ){
		console.error('ApplicationLog_Init: %o', function_return);
	}
	Log_Test();
} else{
	exports.log = Log;
	exports.test = Log_Test;
}
