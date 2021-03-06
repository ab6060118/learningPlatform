import React from 'react';  
import { withStyles } from 'material-ui/styles';
import PropTypes from 'prop-types';
import ApplicationBar from '../AppBar'
import { CircularProgress } from 'material-ui/Progress';
import DisplayTable from '../display-table';
import { FormControlLabel, FormGroup } from 'material-ui/Form';
import Switch from 'material-ui/Switch';
import Grid from 'material-ui/Grid';
import Paper from 'material-ui/Paper';
import Chip from 'material-ui/Chip';
import Typography from 'material-ui/Typography';
import List, { ListItem, ListItemIcon, ListItemText } from 'material-ui/List';
import Button from 'material-ui/Button';
import EndSession from './end-session'
const styles = theme => ({
  progress: {
    margin: `0 ${theme.spacing.unit * 2}px`,
  },
  root: theme.mixins.gutters({
        paddingTop: 8,
        paddingBottom: 8,
        marginTop: theme.spacing.unit * 2,
        overflowX: 'auto',
    }),
  console: theme.mixins.gutters({
        display: 'flex',
        justifyContent: 'right',
        flexWrap: 'wrap',
        height: '40%',
        overflowY: 'auto',
    }),
  chip: {
    margin: theme.spacing.unit,
  },
  fullWidthButton: theme.mixins.gutters({
        marginTop: theme.spacing.unit,
        width: '100%'
    }),
});
  
class TeacherGameStart extends React.Component {  
  constructor(props){
      super(props);
      let that = this;
      this.state = {
          startInfo: null,
          message:[],
          disableStartButton: false,
          showEndScreen: false,
      }
      this.roomNum = this.props.match.params.id;
      this.database = this.props.database;
      this.socket = this.props.socket;
      this.database.database().ref(this.roomNum).child('on').once('value').then(function(data){
          that.setState({
              startInfo: data.val()
          })
      })
      this.database.database().ref(this.roomNum).child('on').child('console').on('child_added', function(data){
          that.setState({
              message: [...that.state.message, data.val()]
          })
      })
      this.database.database().ref(this.roomNum).child('on').child('round').child('currentRound').on('value', function(data){
          that.setState({
              currentRound: data.val()
          })
      })
      this.database.database().ref(this.roomNum).child('on').child('round').child('endSession').on('value',function(data){
          that.setState({
              showEndScreen: data.val()
          })
      })
      this.database.database().ref(this.roomNum).child('on').child('round').child('endroundbutton').on('value',function(data){
          that.setState({
              disableStartButton: data.val()
          })
      })
      this.socket.on('CONNECT_TO_ROOM', function(data) {
            var messageData = {
                message: 'Group '+data.groupNum+' joined Room.'+data.roomNum,
                time: new Date().toLocaleString('en-GB', {timeZone:'Asia/Hong_Kong'})
            }
      }); 
      this.socket.emit('GAME_SETTING',  {roomNum: this.roomNum});
  }
  addMessageToDatabase(message){
      this.database.database().ref(this.roomNum).child('on').child('console').push().set(message)
  }
  calculateRoundValue(){
      let that = this;
      console.log(this.state.currentRound)
      
      return this.database.database().ref(this.roomNum+'/on/round/round'+this.state.currentRound).once('value').then(function(data){
        var roundInfo = data.val();
        var totalQuantityInThisRound = 0;
        var totalCostArray = [];
        for(var i = 1; i<=parseInt(that.state.startInfo.roomInfo.firmNum);i++){
            var companyQuantity = parseInt(roundInfo[i].quantityProduction);
            
            totalQuantityInThisRound = totalQuantityInThisRound + companyQuantity;
            var coefficientOne = parseFloat(that.state.startInfo['company_'+i].coefficientOne)
            var coefficientTwo = parseFloat(that.state.startInfo['company_'+i].coefficientTwo)
            var coefficientThree = parseFloat(that.state.startInfo['company_'+i].coefficientThree)
            var constant = parseFloat(that.state.startInfo['company_'+i].constant)
            var totalCost = coefficientOne * companyQuantity + coefficientTwo * companyQuantity * companyQuantity + coefficientThree * companyQuantity *companyQuantity *companyQuantity + constant;
            
            totalCostArray[i-1] = totalCost
            that.database.database().ref(that.roomNum+'/on/round/round'+that.state.currentRound).child(i).child('totalCost').set(totalCost);

            if(companyQuantity == 0){
                that.database.database().ref(that.roomNum+'/on/round/round'+that.state.currentRound).child(i).child('unitCost').set(0);
            }else{
                that.database.database().ref(that.roomNum+'/on/round/round'+that.state.currentRound).child(i).child('unitCost').set(totalCost/companyQuantity);
            }
        }
        var price = 0;
        if(that.state.startInfo.roomInfo.marketType == 'monoply'){

            console.log('monoply')
            price = [];
            for(var i = 1; i<=parseInt(that.state.startInfo.roomInfo.firmNum);i++){
                var tempPrice = parseFloat(that.state.startInfo.roomInfo.constant) + parseFloat(that.state.startInfo.roomInfo.slope) * roundInfo[i].quantityProduction;
                if(tempPrice >= 0){
                    price[i-1] = tempPrice    
                }else{
                    price[i-1] = 0;
                }
                that.database.database().ref(that.roomNum+'/on/round/round'+that.state.currentRound+'/'+i).child('price').set(price[i-1])
            }

        }else{
            var tempPrice = parseFloat(that.state.startInfo.roomInfo.constant) + parseFloat(that.state.startInfo.roomInfo.slope) * totalQuantityInThisRound;
            if(tempPrice >= 0){
                price = tempPrice;
            }else{
                price = 0
            }
            that.database.database().ref(that.roomNum+'/on/round/round'+that.state.currentRound).child('price').set(price);
        }
        var firmQuantity = [];
        for(var s = 1; s<=parseInt(that.state.startInfo.roomInfo.firmNum);s++){
            firmQuantity[s-1] = parseInt(roundInfo[s].quantityProduction);
        }
        var borrow_group = []
        for(var i = 1; i<=parseInt(that.state.startInfo.roomInfo.firmNum);i++){
            var ref_company_i = that.database.database().ref(that.roomNum+'/on/company_'+i);
            var profit = 0;
            var nowCash = 0;
            if(that.state.startInfo.roomInfo.marketType == 'monoply'){
                profit = price[i-1] * firmQuantity[i-1] - totalCostArray[i-1];
                that.database.database().ref(that.roomNum+'/on/round/round'+that.state.currentRound).child(i).child('revenue').set(price[i-1] * firmQuantity[i-1]);
                nowCash = parseFloat(that.state.startInfo['company_'+i].assetCash) + profit 
            }else{
                profit = price * firmQuantity[i-1] - totalCostArray[i-1];
                that.database.database().ref(that.roomNum+'/on/round/round'+that.state.currentRound).child(i).child('revenue').set(price * firmQuantity[i-1]);
                nowCash = parseFloat(that.state.startInfo['company_'+i].assetCash) + profit  
            }
            that.database.database().ref(that.roomNum+'/on/round/round'+that.state.currentRound).child(i).child('profit').set(profit);
            var nextRountRef = that.database.database().ref(that.roomNum+'/on/round/round'+(that.state.currentRound+1));
            console.log(parseFloat(roundInfo[i].numBorrowing))
            if(roundInfo[i].isBorrowing && parseFloat(roundInfo[i].numBorrowing)){
                borrow_group.push({
                    groupNum: i,
                    numBorrowing: Number(roundInfo[i].numBorrowing)
                })
            
                
                // nextRountRef.child(i).child('borrowed').set(numBorrowing);
            }else{
                ref_company_i.child('assetCash').set(nowCash)
                // nextRountRef.child(i).child('borrowed').set(0);
            }
            var newBeg = parseFloat(that.state.startInfo['company_'+i].netIncome) + parseFloat(that.state.startInfo['company_'+i].beg); 
            ref_company_i.child('beg').set(newBeg);
            ref_company_i.child('netIncome').set(profit);
        }
        console.log(borrow_group)
        borrow_group.map(function(group){
            console.log(roundInfo)
            console.log(group.groupNum)
            that.database.database().ref(that.roomNum+'/on/company_'+group.groupNum).child('liabilitiesBorrwoing').once('value').then(function(data){
                console.log(roundInfo)
                console.log(roundInfo[group.groupNum])
                return parseFloat(roundInfo[group.groupNum].numBorrowing)  + parseFloat(data.val());
            }).then(function(money){
                that.database.database().ref(that.roomNum+'/on/company_'+group.groupNum).child('liabilitiesBorrwoing').set(money)
                return money
            }).then(function(money){
                that.database.database().ref(that.roomNum+'/on/company_'+group.groupNum).child('assetCash').set(nowCash+money)
            }   
            )
        })
      }).then(function(){
          
      })
  }
  endRound(ev){
      let that = this;
      ev.preventDefault();
      this.calculateRoundValue().then(function(){
        that.database.database().ref(that.roomNum+'/on/round/endroundbutton').set(true);
        that.addMessageToDatabase({message:'End Round'+ that.state.currentRound, time: new Date().toLocaleString('en-GB', {timeZone:'Asia/Hong_Kong'})})
        that.database.database().ref(that.roomNum+'/on/round/endSession').set(true);
      })
  }
  render() { 
    const { classes } = this.props;
    if(this.state.showEndScreen){
        return(
            <div>
                {/* <ApplicationBar type = 'Result'/> */}
                <EndSession database = {this.database} roomNum = {this.roomNum}/>
            </div>
        )
    }else{
        if(!this.state.startInfo || !this.state.message || !this.state.currentRound){
            return <div><CircularProgress className={classes.progress} size={50} /></div>
        }else{
            return (
                <div>
                <ApplicationBar type = 'teacher_gamestart'/>
                <Grid container 
                alignItems = 'center'
                justify = 'center'
                height = '100%'
                direction = 'row'>
                <Grid item xs={10}>
                    <FormControlLabel
                    control={
                        <Switch
                        checked={this.state.display_table}
                        onChange={(event, checked) => this.setState({ display_table: checked })}
                        />
                    }
                    label="Display Table"
                    />            
                    {this.state.display_table && 
                        <Paper className = { classes.root } elevation = { 4 } height = '100%'>
                            <DisplayTable info = {this.state.startInfo} numberOfCompany = {this.state.startInfo.roomInfo.firmNum}/>
                        </Paper>
                    }    
                </Grid>

                <Grid item xs={10}>
                <Paper className = { classes.console } elevation = { 4 } height = '100%'>
                    <List>
                    <ListItem >
                        <Typography color = "secondary" type="title" component="h2"  > Console </Typography>
                    </ListItem>
                    {
                        this.state.message &&
                        this.state.message.map(function(data, index){
                            return <ListItem key={index}>
                                        <Chip label={data.time} className={classes.chip} /> <Typography style={{margin: 'auto'}} type = 'body1'>{data.message}</Typography>
                                    </ListItem>
                        })
                    }
                    </List>
                </Paper>
                <Button disabled = {this.state.disableStartButton} raised color="primary" className={classes.fullWidthButton} onClick={this.endRound.bind(this)}>
                    {'End '+(this.state.currentRound)} 
                </Button>      
                </Grid>

                </Grid>
                </div>
            )
        }
    }
  }
}
TeacherGameStart.propTypes = {
    classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(TeacherGameStart)
