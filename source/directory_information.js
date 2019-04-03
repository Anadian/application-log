#!/usr/local/bin/node

/**
* @file directory_information.js
* @brief Gets exhaustive directory information in JSON format.
* @author Anadian
* @copyright 	Copyright 2018 Canosw
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
	const Log = require('./log.js');
	//Standard
	const FileSystem = require('fs');
	const Path = require('path');
	const Cryptography = require('crypto');
	//External

//Constants
const FILENAME = 'directory_information.js';
const MODULE_NAME = 'Directory_Information';
var PROCESS_NAME = '';
if(require.main === module){
	PROCESS_NAME = 'Directory_Information';
} else{
	PROCESS_NAME = process.argv0;
}

//Functions
/**
* @fn Directory_Information
* @brief Gets exhaustive directory information in JSON format.
* @param directory
*	@type String
*	@brief The directory to get information on.
*	@default null
* @param symlink
*	@type Boolean
*	@brief Stat the symlink files themselves (lstat) instead of the files they point to. (stat)
*	@default false
* @param recurse
*	@type Boolean
*	@brief Recurse any subdirectories encountered.
*	@default false
* @return <ARRAY>
*	@entry 0 
*		@retval 1 premature return.
*		@retval 0 on success.
*		@retval <0 on failure.
*	@entry 1
*		@retval <object> on success
*		@retval <error_message> on failure.
*/
function Directory_Information( directory, symlink, recurse ){
	var _return = [1,null];
	const FUNCTION_NAME = 'Directory_Information';
	//Variables
	var directory_stats = null;
	var readdir_return = null;
	var directory_information_array = [];
	var file_information_object = {};
	var directory_information_return = null;
	var file_data = '';

	Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','received: '+arguments.toString());
	//Parametre checks
	if(directory == undefined) directory = null;
	if(symlink == undefined) symlink = false;
	if(recurse == undefined) recurse = false;
	
	//Function
	if( directory != null ){
		if( FileSystem.existsSync(directory) === true ){
			if( symlink === true ){
				directory_stats = FileSystem.lstatSync(directory);
			} else{
				directory_stats = FileSystem.statSync(directory);
			}
			if( directory_stats.isDirectory() === true ){
				readdir_return = FileSystem.readdirSync(directory, 'utf8');
				Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','readdir_return: ', readdir_return);
				for( var i = 0; i < readdir_return.length; i++ ){
					file_information_object = {
						name: readdir_return[i],
						path: Path.join( directory, readdir_return[i] )
					};
					try{
						file_information_object.read = FileSystem.accessSync( file_information_object.path, FileSystem.constants.R_OK );
					} catch(error){
						Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug',error);
						file_information_object.read = null;
					}
					try{
						file_information_object.write = FileSystem.accessSync( file_information_object.path, FileSystem.constants.W_OK );
					} catch(error){
						Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug',error);
						file_information_object.write = null;
					}
					try{
						file_information_object.execute = FileSystem.accessSync( file_information_object.path, FileSystem.constants.X_OK );
					} catch(error){
						Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug',error);
						file_information_object.execute = null;
					}
					if( symlink === true ){
						file_information_object.stats = FileSystem.lstatSync( file_information_object.path );
					} else{
						file_information_object.stats = FileSystem.statSync( file_information_object.path );
					}
					if( ( file_information_object.stats.isDirectory() === true ) ){
						file_information_object.type = 'directory';
						if( ( recurse === true ) ){
							directory_information_return = Directory_Information( file_information_object.path, symlink, true );
							if( directory_information_return[0] === 0 ){
								file_information_object.contents = directory_information_return[1];
							}
						}
					} else if( file_information_object.stats.isSymbolicLink() === true ){
						file_information_object.type = 'symlink';
						file_information_object.target = FileSystem.readlinkSync( file_information_object.path, 'utf8' );
					} else if( file_information_object.stats.isFile() === true ){
						file_information_object.type = 'file';
						file_data = FileSystem.readFileSync( file_information_object.path, 'utf8' );
						let SHA256 = Cryptography.createHash('sha256');
						SHA256.update( file_data, 'utf8' );
						file_information_object.sha256 = SHA256.digest('hex');
					}
					directory_information_array.push(file_information_object);
				}
				if( directory_information_array != [] ){
					_return = [0, directory_information_array];
				}
			}
		} else{
			Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','"directory" does not exist.');
		}
	} else{
		Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','"directory" not a valid string: ', directory);
	}
	//Return
	Log.log(PROCESS_NAME,MODULE_NAME,FILENAME,FUNCTION_NAME,'debug','returned: '+_return.toString());
	return _return;
}

//Exports and Execution
if(require.main === module){
	const CommandLineArguments = require('command-line-args');
	const CommandLineUsage = require('command-line-usage');

	const CLI_Definitions = [
		{
			header: 'Directory-Information',
			content: 'Get exhaustive directory information in JSON format.'
		},
		{
			header: 'Options',
			optionList: [
				{name: 'help', alias: 'h', type: Boolean, description: 'Print this help text to stdout.'},
				{name: 'input_directory', alias: 'I', type: String, defaultOption: true, description: 'Input directory.'},
				{name: 'stdout', alias: 'o', type: Boolean, description: 'Output to stdout.'},
				{name: 'output_file', alias: 'O', type: String, description: 'Output file.'},
				{name: 'recursive', alias: 'r', type: Boolean, description: 'Include any subdirectories, and their contents, encountered.'},
				{name: 'symlink', alias: 'l', type: Boolean, description: 'Stat the symlink files themselves (lstat) instead of the files they point to. (stat)'}
			]
		}
	];
	const Options = CommandLineArguments(CLI_Definitions[1].optionList);
	if( Options.help === true ){
		console.log(CommandLineUsage(CLI_Definitions));
	} else{
		if( Options.input_directory != null ){
			var directory_information_return = Directory_Information( Options.input_directory, Options.symlink, Options.recursive );
			if( directory_information_return[0] === 0 ){
				var json_string = JSON.stringify( directory_information_return[1], null, '\t' );
				if( typeof(Options.output_file) === 'string' ){
					FileSystem.writeFileSync( json_string, Options.output_file, 'utf8' );
				} else{
					console.log(json_string);
				}
			}
		}
	}	
} else{
	exports.Directory_Information = Directory_Information;
}

