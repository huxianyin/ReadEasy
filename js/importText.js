
var num_words=0;
var focus_id = -1;
var last_word=null;
var curr_word=null;
var dictionary={"JA":{},"ZH":{}}

const language_code={
    "Japanese":"JA",
    "Chinese":"ZH",
};
const api_url="https://api-free.deepl.com/v2/translate";
var auth_key;

const interval = 3*1000;
const update_rate = 100;
var focused_duration=0;

window.addEventListener('DOMContentLoaded', function(){
    fetch('resources/auth_key.txt') // (1) リクエスト送信
    .then(response => response.text()) // (2) レスポンスデータを取得
    .then(data => { // (3)レスポンスデータを処理
        auth_key=data;
    });
  });

// Use Mouse Position to Simulate Gaze Position
var gazePos;
document.onmousemove = handleMouseMove;
function handleMouseMove(event) {
    var dot, eventDoc, doc, body, pageX, pageY;
    event = event || window.event; // IE-ism
    // If pageX/Y aren't available and clientX/Y are,
    // calculate pageX/Y - logic taken from jQuery.
    // (This is to support old IE)
    if (event.pageX == null && event.clientX != null) {
        eventDoc = (event.target && event.target.ownerDocument) || document;
        doc = eventDoc.documentElement;
        body = eventDoc.body;

        event.pageX = event.clientX +
          (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
          (doc && doc.clientLeft || body && body.clientLeft || 0);
        event.pageY = event.clientY +
          (doc && doc.scrollTop  || body && body.scrollTop  || 0) -
          (doc && doc.clientTop  || body && body.clientTop  || 0 );
    }
    gazePos = {
        x: event.pageX,
        y: event.pageY
    };
}

setInterval(check_gaze_word,update_rate);

// 文章を読み込む
document.getElementById('inputfile')
.addEventListener('change', function() {
var fr=new FileReader();
fr.onload=function(){
    var output = document.getElementById('output');
    loaded_text = fr.result;
    var paragraphs = loaded_text.split('\n');
    var id=0;
    var res=""
    for(var para of paragraphs)
    {
        var wordArr = para.split(' ');
        num_words += wordArr.length;
        for(const word of wordArr){
            res=res+"<span id=word_" +id.toString()+">"+ word+"</span>\n";
            id++;
        }
        res = res+"<br>\n"
    }
    output.innerHTML=res;
    last_word=null;
    curr_word=null;
    focus_id=0;
}   
fr.readAsText(this.files[0]);
console.log(screen.width,screen.height);
})

// "注目"のElementを特定する
function check_gaze_word(){
    if(gazePos==null) return;
    curr_word = document.elementFromPoint(gazePos.x-window.pageXOffset, gazePos.y-window.pageYOffset);
    if(curr_word==last_word)
    {
        focused_duration+=update_rate;
        var percentage = focused_duration/interval;
        if(curr_word!=null && curr_word.id.includes("word"))
        {   //console.log(curr_word.offsetWidth)
            ShowProgressBar(percentage,
            curr_word.offsetWidth);
        }
    }
    else
    {
        focused_duration=0;
        if (curr_word!=null && curr_word.id.includes("word"))
        {
            curr_word.style.cssText = 'background-color:yellow';
        }
        if(last_word!=null){last_word.style.cssText='';}
        HideWidet();
        HideProgressBar();
        
    }
    if(focused_duration>interval) Translate();
    
    last_word = curr_word;
}

// 翻訳する
function Translate(){
    //get target language
    if(curr_word!=null && curr_word.id.includes("word"))
    {
        var word = curr_word.innerHTML.split(/[^a-z]+/i)[0];
        var targetLanguage=language_code[document.getElementById("TargetLanguage").value];
        if(!(word in dictionary[targetLanguage]))
        {
            //use translate API
            fetch(GetURL(word,targetLanguage),{method: "POST"})
            .then(response => response.json())
            .then(json => {
                var tranlated = json["translations"][0]["text"];
                dictionary[targetLanguage][word]=tranlated;
                ShowWidget(tranlated);
            });
        }
        else
        {
            var tranlated=dictionary[targetLanguage][word];
            ShowWidget(tranlated);
        }
    }
}


function ShowProgressBar(percentage,word_width){
    var progress = document.getElementById('progress_bar');
    //console.log()
    var word_pos = getScreenPos(curr_word);
    progress.style.top = getY(word_pos.top,progress).toString()+'px';
    progress.style.left = (getX(word_pos.left,progress)+curr_word.offsetWidth).toString()+'px';
    if(percentage<1)
        progress.style.width=percentage*word_width.toString()+'px';
    else progress.style.width='0px';

}

function HideProgressBar()
{
    var progress = document.getElementById('progress_bar')
    progress.style.width='0px';
}

function ShowWidget(info)
{
    var widget = document.getElementById('word_info');
    widget.innerHTML = "<p>"+info+"<p/>";
    // change position
    widget.style.top = getY(gazePos.y,widget).toString()+'px';
    widget.style.left = getX(gazePos.x,widget).toString()+'px';
}

function HideWidet()
{
    var widget = document.getElementById('word_info')
    widget.innerHTML="";
}

function GetURL(word,target_lang)
{
    return api_url+"?auth_key="+auth_key+"&text="+word+"&target_lang="+target_lang;
}


function getY(y, oElement )
{
    var widget_offset_y=oElement.offsetHeight*1.5;
    oElement = oElement.offsetParent;

    var iReturnValue = y;
    while( oElement != null ) {
        iReturnValue -= oElement.offsetTop;
        oElement = oElement.offsetParent;
    }
    return iReturnValue-widget_offset_y;
}

function getX(x, oElement )
{
    var widget_offset_x=oElement.offsetWidth;
    oElement = oElement.offsetParent;

    var iReturnValue = x;
    while( oElement != null ) {
        iReturnValue -= oElement.offsetLeft;
        oElement = oElement.offsetParent;
    }
    return iReturnValue-widget_offset_x;
}

function getScreenPos(el) {
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY
    };
  }
  

function readTextFile(file)
{
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                var allText = rawFile.responseText;
                alert(allText);
            }
        }
    }
    rawFile.send(null);
}