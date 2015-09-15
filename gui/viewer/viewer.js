
/* Globals */
var g_ParsedData = {};

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
		Engine.PopGuiPage();
		return;
	}
	else if (typeof template === "string")
	{
	//	todo: fetch object automatically
		warn("string provided: "+template);
		Engine.PopGuiPage();
		return;
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

	if (template.auras)
		txt += getAurasTooltip(template) + "\n";

	Engine.GetGUIObjectByName("entityInfo").caption = txt;

	Engine.GetGUIObjectByName("entityStats").caption = getEntityCostTooltip(template, 1) +"\n"+ getEntityStats(template);
}

function loadTemplateFromName(templateName)
{
	
	
	
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
