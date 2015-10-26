
/* Globals */
var g_SelectedCiv = "gaia"; // fallback default
var g_CallbackSet = false;
var g_Template = {};


/**
 * Page initialisation. May also eventually pre-draw/arrange objects.
 * 
 * @arg template The object or the template name of the entity to be displayed
 */
function init (template = null) {
	if (!template)
	{
		error("Viewer: No template provided");
		closeViewer();
		return;
	}
	else if (typeof template === "string" || template.entityName)
	{
		var templateName = template.entityName || template;
		if (template.callback)
			g_CallbackSet = true;
		if (template.civ)
			g_SelectedCiv = template.civ;

		g_Template = loadTemplateFromName(templateName);
		if (!g_Template)
		{
			error("Viewer: unable to recognise or load template: "+templateName);
			closeViewer();
			return;
		}
	}
	else
	{
		if (template.civ)
			g_SelectedCiv = template.civ;
		g_Template = template;
	}

	draw();
}

/**
 * Populate the UI elements.
 */
function draw ()
{
	Engine.GetGUIObjectByName("entityName").caption = getEntityNamesFormatted(g_Template);
	Engine.GetGUIObjectByName("entityIcon").sprite = "stretched:session/portraits/" + g_Template.icon;

	if (g_Template.promotion)
		Engine.GetGUIObjectByName("entityRankGlyph").sprite = "stretched:" + getRankGlyph(g_Template.promotion.current_rank);
	Engine.GetGUIObjectByName("entityRankGlyph").hidden = !(g_Template.promotion);

	var caption = "";
	if (g_Template.cost)
		caption += getEntityCostTooltip(g_Template, 1) + "\n";
	Engine.GetGUIObjectByName("entityStats").caption = caption + getEntityStats(g_Template);

	var txt = "";

	if (g_Template.tooltip)
		txt += "\n" + txtFormats.body[0] +  translate(g_Template.tooltip) + txtFormats.body[1] + "\n";

	if (g_Template.history)
		txt += "\n" + txtFormats.body[0] +  translate(g_Template.history) + txtFormats.body[1] + "\n";

	if (g_Template.description)
		txt += "\n" + txtFormats.body[0] +  translate(g_Template.description) + txtFormats.body[1] + "\n";

	if (g_Template.auras)
		txt += getAurasTooltip(g_Template) + "\n";
	
	txt += getVisibleEntityClassesFormatted(g_Template);

	Engine.GetGUIObjectByName("entityInfo").caption = txt;
}

/**
 * Determines the requested template and loads it
 * 
 * @arg templateName The template name. If loading a technology, then `tech/` must be prefixed.
 * @return The entity object if successful, false if not
 */
function loadTemplateFromName(templateName)
{
	if (templateName.indexOf("|") > -1)
		templateName = templateName.slice(templateName.indexOf("|")+1);
	var prefix = templateName.slice(0, templateName.indexOf("/"));

	switch (prefix)
	{
	case "structures":
	case "other":
		return loadStructure(templateName);
		break;

	case "units":
		return loadUnit(templateName);
		break;

	case "gaia":
		return loadResource(templateName);
		break;

	case "tech":
		return loadTechnology(templateName.substr(templateName.indexOf("/")+1));
		break;

	default:
		// do nothing (error message is given elsewhere)
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

function loadResource(templateName)
{
	var template = loadTemplate(templateName);
	var resource = GetTemplateDataHelper(template);

	resource.history = template.Identity.History;

	resource.supply = {
		"type": template.ResourceSupply.Type.split("."),
		"amount": template.ResourceSupply.Amount,
	};

	return resource;
}

/**
 * Returns the appropriate promotion rank glyph for a given rank
 * 
 * @param rank The rank
 * @return Path to the image
 */
function getRankGlyph(rank)
{
	var ranks = [ "Basic", "Advanced", "Elite" ];
	if (!ranks.indexOf(rank) < 0)
		return null;
	return "session/icons/rank" + (ranks.indexOf(rank) + 1) + ".png";
}

/**
 * Closes the page
 */
function closeViewer() 
{ 
	if (g_CallbackSet)
		Engine.PopGuiPageCB(0); 
	else 
		Engine.PopGuiPage(); 
}
