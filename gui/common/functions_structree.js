/*
	DESCRIPTION	: Functions related to reading templates
	NOTES		: 
*/

var g_TemplateData = {};
var g_TechnologyData = {};

// ====================================================================


function loadTemplate (code)
{
	if (!(code in g_TemplateData))
	{
		// Load XML file and convert into JS Object data if valid file
		var filename = "simulation/templates/" + code + ".xml";
		var data = ReadXMLFile(filename);
		translateObjectKeys(data, ["GenericName", "Tooltip"]);
		
		g_TemplateData[code] = data;
	}
	
	return g_TemplateData[code];
}

function loadTechData (code)
{
	if(!(code in g_TechnologyData))
	{
		var filename = "simulation/data/technologies/" + code + ".json";
		var data = parseJSONData(filename);
		translateObjectKeys(data, ["genericName", "tooltip"]);
		
		g_TechnologyData[code] = data;
	}
	
	return g_TechnologyData[code];
}

// ====================================================================

/**
 * Merges two given arrays of tokens
 *
 * @param  arr1  First array of tokens
 * @param  arr2  Second array of tokens
 *
 * @return  The merged array, with token matches such as "exampleToken" and
 *           "-exampleToken" resolved
 */
function mergeTokenArray (arr1, arr2)
{
	var ret = [];
	
	for (let tok of arr1)
		if (arr2.indexOf("-"+tok) == -1 && arr2.indexOf(tok.slice(1)) == -1)
			ret.push(tok);
	
	for (let tok of arr2)
		if (arr1.indexOf("-"+tok) == -1 && arr1.indexOf(tok.slice(1)) == -1)
			ret.push(tok);
	
	return ret;
}


/**
 * Fetch a value recursively from an entity's template and parents
 *
 * @param  template  The template to start the fetch from. May be either the
 *                    string template id, or the template object itself
 * @param  keypath   The path to the value to be fetched. "Identity/GenericName"
 *                    is equivalent to {"Identity":{"GenericName":"FOOBAR"}}
 * @param  collate   Whether collation of the values is desired. Currently only
 *                    used with tokens. Default false.
 *
 * @return  The content requested at the key-path defined, or a blank array if
 *           not found
 */
function fetchValue(template, keypath, collate)
{
	if (collate === undefined)
		collate = false;
	var keys = keypath.split("/");
	var ret = [];
	var tParent = false;
	
	if (typeof template === "string")
	{
		template = loadTemplate(template);
		if (template["@parent"] !== undefined)
			tParent = template["@parent"];
	}
	else if (typeof template === "object")
		tParent = template["@parent"];
	else
	{
		warn("fetchValue: template param is unusable (is "+ typeof template +")");
		return [];
	}
	
	for (let k=0; k < keys.length; k++)
	{
		if (template[keys[k]] !== undefined)
		{
			if (k == keys.length-1)
			{
				// if we've come to the end of the key path, then this is the value we want
				// unless we're collating tokens, return it directly
				// if we are collating, we add it to the collection, then continue with this template's parent
				if (collate)
				{
					ret = mergeTokenArray(ret, template[keys[k]]);
					if (tParent)
						ret = mergeTokenArray(ret, fetchValue(tParent, keypath, collate));
					break;
				}
				else
				{
					return template[keys[k]];
				}
			}
			else
			{
				// Not there yet, keep following the key-path
				template = template[keys[k]];
			}
		}
		else
		{
			// if the key-path doesn't exist in this template, try the template's parent
			if (tParent)
			{
				if (!collate)
					return fetchValue(tParent, keypath, collate);
				
				ret = mergeTokenArray(ret, fetchValue(tParent, keypath, collate));
			}
			break;
		}
	}
	return ret;
}


// ====================================================================


/*
 * This is a crude and possibly inefficient XML-File to JSON converter
 *
 * I am personally not very happy with the implementation, and would welcome
 *   someone coming up with a better version
 *
 * Notes:
 *  - 0AD/Pyrogenesis has a XML Parser built-in, for use during games. However,
 *     it can only be used when there's an actual game active as it requires a
 *     player to be set and registered with the engine.
 *  - Every XML-JSON convertor I skimmed through on GitHub are all designed to
 *     be used in a web browser, and works by first converting the XML string
 *     into a DOM object using one of two web-browser specific functions, neither
 *     of which is implemented in 0AD.
 *  - This converter takes an XML File, reads it in as an XML String, turns it
 *     into a JSON String, and then runs it through JSON.parse()
 *  - The converter below has a case for dealing with datatype=tokens, something
 *     that wouldn't ordinarily be a part of an XML-JSON convertor
 */
function ReadXMLFile (pathname) {
	
	var xmlString = Engine.ReadFile(pathname);
	if (!xmlString)
		error(sprintf("Failed to read file: %(path)s", { path: pathname }));
	
	var jsonString = "{";
	var pos = xmlString.indexOf("?"); // so we don't pick up the <?xml ... ?> definition tag
	var tokens = false;
	var lastTag = "";
	
	do
	{
		let b1 = xmlString.indexOf("<", pos);
		if (b1 < 0)
			break;
		
		let content = xmlString.slice(pos, b1).trim();
		b1 += 1;
		let b2 = xmlString.indexOf(">", b1);
		pos = b2 + 1;
		let tag = xmlString.slice(b1, b2).split(" ");
		
		if (xmlString.charAt(b1) == "!")
		{
			// skip comments
			continue;
		}
		
		if (xmlString.charAt(b1) == "/")
		{
			jsonString = jsonString.slice(0, -1);
			if (content !== "")
			{
				if (content.indexOf("\n") > -1) // may need to rethink this at a later time, as it removes newlines that may
					content = content.replace(/[\n\t]/g, ""); // have been placed there purposely (ie. in the case of tooltips)
				
				if (content.indexOf("\"") > -1)
					content = content.replace("\"", "\\\"", "g");
				
				jsonString += (tokens) ? "[\""+ content.split(/\s+/).join("\",\"") +"\"]," : "\""+content+"\",";
			}
			else
			{
				jsonString += (tag[0].slice(1) == lastTag) ? "\" \"," : "},";
			}
			tokens = false;
		}
		else
		{
			if (tag[0].endsWith("/"))
				jsonString += " \"" + tag[0].slice(0,-1) + "\":" + true + ",";
			else
				jsonString += " \"" + tag[0] + "\":{";
			lastTag = tag[0];
		}
		
		for (let a = 1; a < tag.length; a++)
		{
			let attr = tag[a].split("=");
			if (attr[0] == "datatype" && attr[1].slice(0,8) == "\"tokens\"")
			{
				if (attr[1].charAt(8) == "/")
					jsonString = jsonString.slice(0,-1) + "[],";
				else
					tokens = true;
				continue;
			}
			jsonString += "\"@"+attr[0]+"\":";
			if (attr[1].endsWith("/"))
				jsonString += attr[1].slice(0,-1)+"},";
			else
				jsonString += attr[1]+",";
		}
		
	} while (pos < xmlString.length);
	
	jsonString = jsonString.slice(0, -1) + "}";
	var jsonObject;
	
	try
	{
		jsonObject = JSON.parse(jsonString);
	}
	catch (err)
	{
		error(sprintf("%(error)s: parsing XML data in '%(path)s'", { error: err.toString(), path: pathname }));
		
		var ll = 140;
		for (let i=0; i<jsonString.length; i)
		{
			error(jsonString.slice(i, i+ll));
			i += ll;
		}
	}
	
	if (jsonObject !== undefined)
		return jsonObject.Entity;
	else
		return {};	
}

function depath (path)
{
	var pos = path.lastIndexOf("/");
	if (pos > -1)
		path = path.slice(pos+1);
	
	return path;
}

Array.max = function (arr)
{
	var max = -Infinity;
	for (let i in arr)
		if (+arr[i] > max)
			max = +arr[i];
	return max;
};

Array.min = function (arr)
{
	var min = Infinity;
	for (let i in arr)
		if (+arr[i] < min)
			min = +arr[i];
	return min;
};
