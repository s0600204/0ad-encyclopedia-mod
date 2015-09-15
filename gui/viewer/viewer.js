
/* Globals */
var g_ParsedData = {};
var g_SelectedCiv = "rome";
var g_CallbackSet = false;

/**
 * Init
 * 
 * @arg template For the moment, the object to be shown
 * 
 */
function init (template = null) {
	if (!template)
	{
		warn("No Template provided");
		closeViewer();
		return;
	}
	else if (typeof template === "string" || template.entityName)
	{
		var templateName = template.entityName || template;
		if (template.callback)
			g_CallbackSet = true;

		template = loadTemplateFromName(templateName);
		if (!template)
		{
			warn("Unable to load template: "+templateName);
			closeViewer();
			return;
		}
	}

//	warn(uneval(template));

	/*var specific = Engine.GetGUIObjectByName("dialogTitle");
	var generic = Engine.GetGUIObjectByName("entityName");
	if (template.name.specific)
	{
		// drop caps for specific name
		specific.caption = template.name.specific.toUpperCase();
		
		if (template.name.generic)
			generic.caption = "("+ template.name.generic +")";
	}
	else if (template.name.generic)
		specific.caption = template.name.generic;
	else
		specific.caption = "?";*/

	Engine.GetGUIObjectByName("entityName").caption = getEntityNamesFormatted(template);
	Engine.GetGUIObjectByName("entityIcon").sprite = "stretched:session/portraits/" + template.icon;

	var txt = "";

	if (template.tooltip)
		txt += "\n" + txtFormats.body[0] +  translate(template.tooltip) + txtFormats.body[1] + "\n";

	if (template.history)
		txt += "\n" + txtFormats.body[0] +  translate(template.history) + txtFormats.body[1] + "\n";

	if (template.description)
		txt += "\n" + txtFormats.body[0] +  translate(template.description) + txtFormats.body[1] + "\n";

	if (template.auras)
		txt += getAurasTooltip(template) + "\n";

	Engine.GetGUIObjectByName("entityInfo").caption = txt;

	Engine.GetGUIObjectByName("entityStats").caption = getEntityCostTooltip(template, 1) +"\n"+ getEntityStats(template);
}

function loadTemplateFromName(templateName)
{
	var prefix = templateName.substr(0, templateName.indexOf("/"));

	switch (prefix)
	{
	case "structures":
	case "other":
		return loadStructure(templateName);
		break;
	case "units":
	case "gaia":
		return loadUnit(templateName);
		break;
	
	case "tech":
		return loadTechnology(templateName.substr(templateName.indexOf("/")+1));
		break;
	default:
		warn("Unrecognised prefix: "+prefix);
	}

	return false;
}

/**
 * Overrides near-identical function in gui/common/tooltips.js
 * (Just so we can get slightly bigger text)
 */
function getEntityNamesFormatted(template)
{
	var names = "";
	var generic = template.name.generic;
	var specific = template.name.specific;
	if (specific)
	{
		// drop caps for specific name
		names += '[font="sans-bold-20"]' + specific[0] + '[/font]' +
			'[font="sans-bold-16"]' + specific.slice(1).toUpperCase() + '[/font]';

		if (generic)
			names += '[font="sans-bold-16"] (' + generic + ')[/font]';
	}
	else if (generic)
		names = '[font="sans-bold-20"]' + generic + "[/font]";
	else
		names = "???";

	return names;
}

function closeViewer() 
{ 
	if (g_CallbackSet)
		Engine.PopGuiPageCB(0); 
	else 
		Engine.PopGuiPage(); 
}
