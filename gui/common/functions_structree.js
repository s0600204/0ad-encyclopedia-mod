	/*
	DESCRIPTION	: Functions related to reading templates
	NOTES		: 
*/

var g_TemplateData = {};

// ====================================================================


function loadTemplate (code)
{
	if (!(code in g_TemplateData))
	{	// Load XML file and convert into JS Object data if valid file
		var filename = "simulation/templates/" + code + ".xml";
		var data = parseXMLData(filename);
		
		g_TemplateData[code] = data;
	}
	
	return g_TemplateData[code];
}

// ====================================================================

function parseXMLData (pathname)
{
	var rawData = Engine.ReadFile(pathname);
	if (!rawData)
	{
		error(sprintf("Failed to read file: %(path)s", { path: pathname }));
	}
	else
	{
		try
		{	// Catch nasty errors from XML parsing
			var data = XML.parse(rawData);
		}
		catch(err)
		{
			error(sprintf("%(error)s: parsing XML data in %(path)s", { error: err.toString(), path: pathname }));
		}
	}
	return data;
}


// ====================================================================

var XML = {};
/*
 * This is a crude and possibly inefficient XML-String to JSON converter
 *
 * I am personally not very happy with the implementation, and would welcome someone coming up with a better version
 *
 * Notes:
 *  - 0AD/Pyrogenesis has a XML Parser built-in, for use during games. However, it can only be used when there's an actual
 *     game active as it requires a player to be set and registered with the engine.
 *  - Every XML-JSON convertor I skimmed through on GitHub are all designed to be used in a web browser, and works by first
 *     converting the XML string into a DOM object using one of two web-browser specific functions, neither of which is
 *     implemented in 0AD.
 *  - This converter takes an XML String, turns it into a JSON String, and then runs it through JSON.parse()
 *  - The converter below has a case for dealing with datatype=tokens, something that wouldn't ordinarily be a part of an
 *     XML-JSON convertor
 */
XML.parse = function (xmlString) {
	var ret = "{";
	var pos = xmlString.indexOf("?"); // so we don't pick up the <?xml ... ?> definition tag
	var tokens = false;
	var lastTag = "";
	
	do {
		var b1 = xmlString.indexOf("<", pos);
		if (b1 < 0)
			break;
		
		var content = xmlString.slice(pos, b1).trim();
		b1 += 1;
		var b2 = xmlString.indexOf(">", b1);
		pos = b2 + 1;
		var tag = xmlString.slice(b1, b2).split(" ");
		
		if (xmlString.charAt(b1) == "/")
		{
			ret = ret.slice(0, -1);
			if (content !== "")
			{
				if (content.indexOf("\n") > -1) // may need to rethink this at a later time, as it removes newlines that may
					content = content.replace("\n", "", "g"); // have been placed there purposely (ie. in the case of tooltips)
				
				if (content.indexOf("\"") > -1)
					content = content.replace("\"", "\\\"", "g");
				
				ret += (tokens) ? "[\""+ content.split(/\s+/).join("\",\"") +"\"]," : "\""+content+"\",";
			}
			else
			{
				ret += (tag[0].slice(1) == lastTag) ? "\" \"," : "},";
			}
			tokens = false;
		}
		else
		{
			if (tag[0].endsWith("/"))
			{	
				ret += " \"" + tag[0].slice(0,-1) + "\":" + true + ",";
			} else {
				ret += " \"" + tag[0] + "\":{";
			}
			lastTag = tag[0];
		}
		
		for (var a = 1; a < tag.length; a++)
		{
			var attr = tag[a].split("=");
			if (attr[0] == "datatype" && attr[1] == "\"tokens\"") {
				tokens = true;
				continue;
			}
			ret += "\"@"+attr[0]+"\":";
			if (attr[1].endsWith("/"))
			{
				ret += attr[1].slice(0,-1)+"},";
			} else {
				ret += attr[1]+",";
			}
		}
		
	} while (pos < xmlString.length);
	
	ret = ret.slice(0, -1) + "}";
	
	try {
		ret = JSON.parse(ret)["Entity"];
	} catch (err) {
		var ll = 140;
		for (var i=0; i<ret.length; i) {
			error(ret.slice(i, i+ll));
			i += ll;
		}
		throw err;
	}
	return ret;
}

