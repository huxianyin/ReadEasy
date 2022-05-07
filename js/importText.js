document.getElementById('inputfile')
.addEventListener('change', function() {
var fr=new FileReader();
fr.onload=function(){
    var output = document.getElementById('output');
    loaded_text = fr.result;
    var wordArr = loaded_text.split(' ');
    var id=0;
    var res=""
    for(const word of wordArr){
        console.log(word);
        res=res+"<span id=word_" +id.toString()+">"+ word+"</span>\n"
        id++;
    }
    output.innerHTML=res;
}   
fr.readAsText(this.files[0]);
})