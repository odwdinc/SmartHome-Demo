function Aio(port){
        this.upm = require('jsupm_ads1x15');

        switch(port) {
                case 0:
                        this.port = this.upm.ADS1X15.SINGLE_0;
                        break;
                case 1:
                        this.port = this.upm.ADS1X15.SINGLE_1;
                        break;
                case 2:
                        this.port = this.upm.ADS1X15.SINGLE_2;
                        break;
                case 3:
                        this.port = this.upm.ADS1X15.SINGLE_3;
                        break;
                default:
                        this.port = this.upm.ADS1X15.SINGLE_0;
        }
        //this.port = port;
        //this.upm = require('jsupm_ads1x15');
        this.ads1115 = new this.upm.ADS1115(0, 0x48);
        this.ads1115.getSample(this.upm.ADS1X15.SINGLE_0);
        this.ads1115.setGain(this.upm.ADS1X15.GAIN_ONE);
        this.ads1115.setSPS(0x0080);
        this.ads1115.setContinuous(true);
}

Aio.prototype.read = function() {
        return this.ads1115.getSample(this.port);
};



exports.Aio = Aio;
